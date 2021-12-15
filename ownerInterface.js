#!/usr/bin/env node

const db = require("./db/index");
const format = require("pg-format");
const {listBooks, getInteger} = require("./db");
const faker = require("faker/locale/en");
const prompt = require("prompt-sync")({sigint: true});

let loggedin = "none";

init();

function init() {
    console.log("\n=== Welcome to the LookInnaBook Bookstore Owner Terminal ===");
    // login().then((loginSuccess) => {
    //     if (loginSuccess) {
    //         loggedin = loginSuccess
    //         ownerLoop();
    //     }
    // });

    ownerLoop();
}

async function login() {
    let loggedinId = null;

    while (true) {
        console.log("\nLogin (enter an empty value at any time to abort)")
        let userId = prompt("   User ID? > ");
        if (!userId) break;
        let userPw = prompt("   User PW? > ");
        if (!userPw) break;

        const userQuery = await db
            .query(format('SELECT is_owner FROM "user" WHERE id = %L AND password = %L',
                userId, userPw))
            .catch(console.log);

        if (userQuery.rows[0] && userQuery.rows[0]["is_owner"] === true) {
            console.log("Login Success! Loading Bookstore...");
            loggedinId = userId;
            break;
        } else {
            console.log("Login Failed. Check ID/PW, and that the account is not a user.");
        }
    }

    return loggedinId;
}

function ownerLoop() {
    mainMenu().then();
}

async function mainMenu() {
    let ongoing = true;

    while (ongoing) {
        console.log("\nMain Menu:");
        console.log("   (1) List All Books");
        console.log("   (2) Add Book");
        console.log("   (3) Remove Book");
        console.log("   (4) View Publishers");
        console.log("   (5) View Reports");
        console.log("   (0) Exit");

        switch (prompt("Selection > ")) {
            case "1":
                await listBooks().catch(console.log);
                break;
            case "2":
                await addBook().catch(console.log);
                break;
            case "3":
                await removeBook().catch(console.log);
                break;
            case "0":
                console.log("Exiting...")
                ongoing = false;
                db.end();
                console.log(`Have a nice day, ${loggedin}.`)
                break;
            default:
                break;
        }
    }
}

async function addBook() {
    const publishers = await db.query({
        rowMode: "array", text: "SELECT publisher_id FROM publisher"
    }).catch(console.log);

    const genres = await db.query({
        rowMode: "array", text: "SELECT name FROM genre ORDER BY name"
    }).catch(console.log);

    const authors = await db.query({
        text: "SELECT id, name FROM author ORDER BY id"
    }).catch(console.log);

    // Initialized with default new book properties to be added if user does not provide alternatives
    let newBook = {
        genre: genres.rows[faker.datatype.number(genres.rows.length - 1)],
        author: authors.rows[faker.datatype.number(authors.rows.length - 1)],
        publisherID: publishers.rows[faker.datatype.number(publishers.rows.length - 1)],
        isbn: faker.finance.routingNumber(),
        title: `${faker.commerce.productAdjective()} ${faker.animal.dog()}`.substring(0, 30),
        pages: faker.datatype.number({min: 80, max: 1200}),
        price: faker.datatype.number({min: 5, max: 1200, precision: 0.01}),
        publisherPercent: faker.datatype.number({min: 0, max: 0.5, precision: 0.01}),
        stock: faker.datatype.number({min: 10, max: 50}),
    }

    console.log("\nEnter new book properties, or use defaults with an empty input.");
    console.log("( Genres | Authors | Publisher ID | ISBN | Title | Pages | Price | Publisher % | Stock )");

    console.log("Available genres: " + genres.rows.flat());
    let genreInput;
    do {
        genreInput = prompt(`Genre name? (${newBook.genre}) > `);
    } while (!genres.rows.flat().includes(genreInput) && genreInput)
    if (genreInput)
        newBook.genre = genreInput;

    console.log("Available publisher IDs: " + publishers.rows.flat());
    let pubIdInput;
    do {
        pubIdInput = getInteger(`Publisher ID? (${newBook.publisherID}) > `);
    } while (!publishers.rows.flat().includes(pubIdInput) && pubIdInput)
    if (pubIdInput)
        newBook.publisherID = pubIdInput;

    let authorSelectStr = "Available authors (select by ID): \n";
    for (const author of authors.rows)
        authorSelectStr += `${author["id"]}: ${author["name"]}\n`;
    console.log(authorSelectStr);

    let authorIdInput;
    do {
        authorIdInput = getInteger(`Author ID? (${newBook.author["id"]}: ${newBook.author["name"]}) > `);
    } while (!authors.rows.map(a => a.id).includes(authorIdInput) && authorIdInput)
    if (authorIdInput)
        newBook.author["id"] = authorIdInput;

    let isbnInput = prompt(`ISBN? (${newBook.isbn}) > `);
    if (isbnInput) newBook.isbn = isbnInput;

    let titleInput = prompt(`Title? (${newBook.title}) > `);
    if (titleInput) newBook.title = titleInput.substring(0, 30);

    let pagesInput = getInteger(`Pages? (${newBook.pages}) > `);
    if (pagesInput) newBook.pages = pagesInput;

    let priceInput = getInteger(`Price? (${newBook.price}) > `);
    if (priceInput) newBook.price = priceInput;

    let pubPercentInput;
    do {
        pubPercentInput = getInteger(
            `Publisher percentage? (0-100) (${newBook.publisherPercent * 100}%) > `);
    } while (pubPercentInput < 0 || pubPercentInput > 100)
    if (pubPercentInput) newBook.publisherPercent = pubPercentInput * 0.01;

    let stockInput;
    do {
        stockInput = getInteger(
            `Book stock? (>=10) (${newBook.stock}) > `);
    } while (stockInput < 10 && stockInput !== 0)
    if (stockInput) newBook.stock = stockInput;

    const bookInsert = await db.query(format(
        "INSERT INTO book(publisher_id, isbn, title, pages, price, publisher_percent, stock) " +
        "VALUES %L RETURNING *",
        [[
            newBook.publisherID,
            newBook.isbn,
            newBook.title,
            newBook.pages,
            newBook.price,
            newBook.publisherPercent,
            newBook.stock
        ]]))
        .catch(console.log);

    let insertedId = bookInsert.rows[0]["book_id"];

    await db.query(format("INSERT INTO book_genre(book_id, genre_name) VALUES %L",
        [[insertedId, newBook.genre]]))
        .catch(console.log);

    await db.query(format("INSERT INTO book_author(book_id, author_id) VALUES %L",
        [[insertedId, newBook.author["id"]]]))
        .catch(console.log);

    console.log(`Book "${bookInsert.rows[0].title}" added.`);
}

async function removeBook() {
    let toRemove = getInteger("ID of book to remove > ");
    if (!toRemove) return;

    const delQuery = await db
        .query(format(
            `DELETE FROM book WHERE book_id = %L`, toRemove))
        .catch(console.log);

    if (delQuery.rowCount === 0)
        console.log(`Deletion failed. Book ${toRemove} is invalid or has already been deleted.`);
    else
        console.log(`Book ${toRemove} deleted.`);
}