#!/usr/bin/env node

const db = require("./db/index");
const format = require("pg-format");
const prompt = require("prompt-sync")({sigint: true});

let checkoutBasket = {};
let loggedin = "none";

init();

function init() {
    console.log("\n=== Welcome to the LookInnaBook Bookstore User Terminal ===");
    // login().then((loginSuccess) => {
    //     if (loginSuccess) {
    //         loggedin = loginSuccess
    //         libraryLoop();
    //     }
    // });

    libraryLoop();
}

function libraryLoop() {
    mainMenu().then();
}

async function mainMenu() {
    let ongoing = true;

    while (ongoing) {
        console.log("\nMain Menu:");
        console.log("   (1) List All Books");
        console.log("   (2) Select Book");
        console.log("   (3) Search Books");
        console.log("   (4) Checkout");
        console.log("   (5) Track Orders");
        console.log("   (0) Exit");

        switch (prompt("Selection > ")) {
            case "1":
                await listBooks();
                break;
            case "2":
                await bookMenu();
                break;
            case "4":
                break;
            case "5":
                await trackOrder();
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
                userId, userPw), [])
            .catch(console.log);

        if (userQuery.rows[0] && userQuery.rows[0]["is_owner"] === false) {
            console.log("Login Success! Loading Bookstore...");
            loggedinId = userId;
            break;
        } else {
            console.log("Login Failed. Check ID/PW, and that the account is not an owner.")
        }
    }

    return loggedinId;
}

async function listBooks() {
    const bookQuery = await db
        .query("SELECT * FROM book")
        .catch(console.log);

    console.log("\nDisplaying books.")
    console.log("ID; Title; Authors; Genres; Publisher; Pages; ISBN; Stock")

    for (const book of bookQuery.rows) {
        let bookInfo = await getBookObject(book["book_id"])
        let bookString = "";

        // ID
        bookString += String(bookInfo.id).padStart(2, " ");

        // Title
        bookString += `; `;
        bookString += String(bookInfo.title).padEnd(30, " ");

        // Name(s) of book author(s)
        bookString += `; `;
        bookString += bookInfo.authors.join(", ").padEnd(20, " ");

        // Name(s) of book genre(s)
        bookString += `; `;
        bookString += bookInfo.genres.join(", ").padEnd(15, " ");

        // Name of publisher
        bookString += `; `;
        bookString += String(bookInfo.publisher).padEnd(26, " ");

        // Pages
        bookString += "; "
        bookString += String(bookInfo.pages).padStart(5, " ");

        // ISBN
        bookString += "; "
        bookString += String(bookInfo.isbn).padStart(10, " ");

        // Stock
        bookString += "; "
        bookString += `${bookInfo.stock} left`;

        console.log(bookString);  // Print book information string
    }
}

async function bookMenu() {
    let targetId = prompt("Book ID? > ");

    let book = await getBookObject(targetId);

    if (!book) {
        console.log(`Book ID ${targetId} not found.`);
        return;
    }

    let ongoing = true;

    while (ongoing) {
        console.log(`\nCurrent Book: ${book.title}`);
        console.log("Options:");
        console.log("   (1) View Book Info");
        console.log("   (2) Add To Checkout");
        console.log("   (0) Back to Menu");

        switch (prompt("Selection > ")) {
            case "1":
                console.log(`\nID ${book.id} - ${book.title}`);
                console.log(`ISBN: ${book.isbn}`);
                console.log(`Authors: ${book.authors.join(", ")}`);
                console.log(`Publisher: ${book.publisher}`);
                console.log(`Genres: ${book.genres.join(", ")}`);
                console.log(`Pages: ${book.pages}`);
                console.log(`Price: $${book.price}`);
                console.log(`In Stock: ${book.stock} Copies`);
                break;
            case "2":
                let checkoutCount;
                do {
                    checkoutCount = prompt("How many copies? > ");
                } while (isNaN(checkoutCount) || !Number.isInteger(Number(checkoutCount)))

                checkoutCount = Number(checkoutCount);

                let newStock = book.stock - checkoutCount;
                if (newStock < 0) {
                    newStock = 0;
                    checkoutCount = book.stock;
                    console.log(`Too many copies requested: only ordering ${checkoutCount}`);
                }

                await db.query({
                    text: format(
                        `UPDATE book 
                        SET stock = %L
                        WHERE book_id = %L`,
                        newStock, book.id)
                });

                // TODO: move this out to actual ordering

                if (book.id in checkoutBasket)
                    checkoutBasket[book.id] += checkoutCount;
                else
                    checkoutBasket[book.id] = checkoutCount;

                // Update book object to reflect stock change
                book = await getBookObject(targetId);

                break;
            case "0":
                ongoing = false;
                break;
            default:
                break;
        }
    }
}

// Generates object containing all directly relevant properties of the book with targetId.
// {id, title, authors, genres, publisher, pages, price, isbn, stock}
async function getBookObject(targetId) {
    const bookQuery = await db
        .query(format("SELECT * FROM book WHERE book_id = %L", targetId))
        .catch(console.log);

    if (bookQuery.rows.length === 0)
        return null;

    const authorQuery = await db.query({
        text: format(
            `SELECT author.name 
                FROM book_author JOIN author 
                ON book_author.author_id = author.id
                WHERE book_id = %L`,
            targetId),
        rowMode: "array"
    });

    const genreQuery = await db.query({
        text: format(
            `SELECT book_genre.genre_name 
                FROM book JOIN book_genre 
                ON book.book_id = book_genre.book_id 
                WHERE book.book_id = %L`,
            targetId),
        rowMode: "array"
    });

    const publisherQuery = await db.query({
        text: format(
            `SELECT publisher.name
                    FROM book JOIN publisher
                    ON book.publisher_id = publisher.publisher_id
                    WHERE book.book_id = %L`,
            targetId),
        rowMode: "array"
    });

    return {
        id: targetId,
        title: bookQuery.rows[0]["title"],
        authors: authorQuery.rows.flat(),
        genres: genreQuery.rows.flat(),
        publisher: publisherQuery.rows[0],
        pages: Number(bookQuery.rows[0]["pages"]),
        price: Number(bookQuery.rows[0]["price"]),
        isbn: bookQuery.rows[0]["isbn"],
        stock: Number(bookQuery.rows[0]["stock"])
    };
}

async function trackOrder() {
    let targetOrder = prompt("Order Number? > ");
    const orderQuery = await db
        .query(format(
            `SELECT * FROM "order" WHERE order_num = %L`, targetOrder))
        .catch(console.log);

    if (orderQuery.rows.length === 0) {
        console.log(`Order ${targetOrder} not found.`);
        return;
    }

    const orderBooks = await db
        .query(format(
            `SELECT * FROM order_book NATURAL JOIN book WHERE order_book.order_num = %L`, targetOrder))
        .catch(console.log);

    const orderObj = {
        orderNum: orderQuery.rows[0]["order_num"],
        status: orderQuery.rows[0]["status"],
        billingInfo: orderQuery.rows[0]["billing_info"],
        shippingInfo: orderQuery.rows[0]["shipping_info"],
        books: []
    };

    for (const book of orderBooks.rows) {
        orderObj.books.push({
            bookId: book["book_id"],
            title: book["title"],
            quantity: book["quantity"],
            price: book["price"]
        });
    }

    console.log(`\n=== Displaying Order ${orderObj.orderNum} ===`);
    console.log(`Status: ${orderObj.status}`);
    console.log(`Billing Info: ${orderObj.billingInfo}`);
    console.log(`Shipping Info: ${orderObj.shippingInfo}`);

    // Round monetary values, using only necessary decimals

    let total = 0;
    console.log("Books:");
    for (const book of orderObj.books) {
        console.log(`   ID ${book.bookId} - ${book.title}`);
        console.log(`   $${formatMoney(book.price)} - ${book.quantity} copies`);
        total += book.price * book.quantity;
    }

    console.log("---");
    console.log(`Total: $${formatMoney(total)}`);
}

// Rounds input to rounded string, to max 2 decimal places. Used for money outputs
function formatMoney(input) {
    return +parseFloat(input).toFixed(2);
}