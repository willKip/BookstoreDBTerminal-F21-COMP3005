#!/usr/bin/env node

const db = require("./db/index");
const format = require("pg-format");
const {getBookObject, listBooks, getInteger, getDBConnectionTime} = require("./db");
const prompt = require("prompt-sync")({sigint: true});

let checkoutBasket = {};
let loggedin = "none";

init().then();

async function init() {
    await getDBConnectionTime()
        .catch((err) => {
            console.log(err.toString());
            console.log("Error while accessing DB... did you 'npm run dbinit' first?")
            db.end();
            process.exit(-1);
        })
        .then((res) => console.log(`Connected to lookInnaBook DB on ${res}`));

    console.log("\n=== Welcome to the LookInnaBook Bookstore User Terminal ===");

    login().then((loginSuccess) => {
        if (loginSuccess) {
            loggedin = loginSuccess
            mainMenu().then();
        }
    });
}

// Main menu; offers options to users
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
                await listBooks().catch(console.log);
                break;
            case "2":
                await bookMenu().catch(console.log);
                break;
            case "3":
                await searchBooks().catch(console.log);
                break;
            case "4":
                await checkOutMenu().catch(console.log);
                break;
            case "5":
                await trackOrder().catch(console.log);
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

// Logs into the application; owner accounts will be denied access.
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

// Offers several options regarding a single book.
async function bookMenu() {
    let targetId = getInteger("Book ID? > ");
    if (!targetId) return;

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
        console.log("   (0) Back to Main Menu");

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
                let buyCount = getInteger("How many copies? > ");

                if (buyCount) {
                    if (book.id in checkoutBasket)
                        checkoutBasket[book.id] += buyCount;
                    else
                        checkoutBasket[book.id] = buyCount;
                }
                break;
            case "0":
                ongoing = false;
                break;
        }
    }
}

// Allow user to review and checkout items in the basket.
async function checkOutMenu() {
    console.log(`\n=== Printing checkout basket of user ${loggedin} ===`);

    let bookObjs = [];
    let total = 0;
    for (let i = 0; i < Object.keys(checkoutBasket).length; i++) {
        const bookId = Object.keys(checkoutBasket)[i];

        bookObjs.push(await getBookObject(bookId));
        console.log(`   ID ${bookObjs[i].id} - ${bookObjs[i].title}`);
        console.log(`   $${formatMoney(bookObjs[i].price)} - ${checkoutBasket[bookId]} copies`);
        total += bookObjs[i].price * checkoutBasket[bookId];
    }
    console.log(`Total: $${formatMoney(total)}`);

    let ongoing = true;

    while (ongoing) {
        console.log("\nOptions:");
        console.log("   (1) Checkout items in basket");
        console.log("   (2) Empty basket");
        console.log("   (0) Back to Main Menu");

        switch (prompt("Selection > ")) {
            case "1":
                if (Object.keys(checkoutBasket).length > 0) {
                    // Retrieve enum values of order_status enum
                    const orderStatuses = await db.query({
                        rowMode: "array", text: "SELECT to_json (enum_range(null::order_status))"
                    });

                    let orderStatusArray = orderStatuses.rows[0][0];
                    let billing = prompt("Enter billing info > ");
                    let shipping = prompt("Enter shipping info > ");

                    const newOrderNum = await db.query({
                        text: format(
                            'INSERT INTO "order"(status, billing_info, shipping_info) ' +
                            'VALUES (%L) RETURNING order_num',
                            [orderStatusArray[Math.floor(Math.random() * orderStatusArray.length)],
                                billing,
                                shipping]),
                        rowMode: "array"
                    })
                        .catch(console.log);

                    for (const book of bookObjs) {
                        let newStock = book.stock - checkoutBasket[book.id];
                        if (newStock < 0) {
                            newStock = 0;
                            console.log(
                                `Too many copies requested: only ordering ${book.stock} of ${book.title}`
                            );
                        }
                        let soldCount = book.stock - newStock;

                        await db.query({
                            text: format(
                                `UPDATE book SET stock = %L WHERE book_id = %L`,
                                newStock, book.id)
                        }).catch(console.log);

                        await db.query(format(
                            "INSERT INTO order_book(order_num, book_id, quantity) VALUES (%L)",
                            [newOrderNum.rows[0], book.id, soldCount]
                        )).catch(console.log);

                        // Update appropriate statistics and credits money to publisher

                        // Author sales
                        await db.query(format(
                            "UPDATE author SET sales = sales + %L WHERE id IN (" +
                            "SELECT author_id " +
                            "FROM book JOIN book_author ON book.book_id = book_author.book_id " +
                            "WHERE book.book_id = %L)",
                            soldCount, book.id
                        )).catch(console.log);

                        // Genre sales
                        await db.query(format(
                            "UPDATE genre SET sales = sales + %L WHERE name IN (" +
                            "SELECT genre_name " +
                            "FROM book JOIN book_genre ON book.book_id = book_genre.book_id " +
                            "WHERE book.book_id = %L)",
                            soldCount, book.id
                        )).catch(console.log);

                        // Publisher payment
                        await db.query(format(
                            "UPDATE publisher_banking " +
                            "SET balance = balance + %L * bookInfo.price * bookInfo.publisher_percent " +
                            "FROM ( " +
                            "    SELECT price, publisher_percent " +
                            "    FROM book " +
                            "    WHERE book_id = %L) as bookInfo " +
                            "WHERE id = ( " +
                            "    SELECT banking_id " +
                            "    FROM book JOIN publisher ON book.publisher_id = publisher.publisher_id " +
                            "    WHERE book_id = %L)",
                            soldCount, book.id, book.id
                        )).catch(console.log);
                    }

                    checkoutBasket = {};
                    ongoing = false;
                    console.log(`Checked out. Order number is ${newOrderNum.rows[0]}.`);
                } else {
                    console.log("Checkout basket is empty.");
                }
                break;
            case "2":
                checkoutBasket = {};
                ongoing = false;
                console.log("Basket emptied.");
                break;
            case "0":
                ongoing = false;
                break;
            default:
                break;
        }
    }
}

// Fetch the information for the given order number
async function trackOrder() {
    let targetOrder = getInteger("Order Number? > ");
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

// Searches books with entered parameters.
async function searchBooks() {
    let queryStr = "SELECT DISTINCT book_id FROM book";
    let conditionArray = [];

    console.log("\nEnter search parameters. Leave blank to skip. Text is not case-sensitive.");
    console.log("( Title | ISBN | Min/Max Page | Min/Max Price | Author | Genre )");

    let title = prompt("Title > ");
    let isbn = prompt("ISBN (full or partial) > ");
    let pageMin = getInteger("Min Pages > ");
    let pageMax = getInteger("Max Pages > ");
    let priceMin = getInteger("Min Price > ");
    let priceMax = getInteger("Max Price > ");

    if (title) conditionArray.push(format("title ILIKE %L", `%${title}%`));
    if (isbn) conditionArray.push(format("isbn ILIKE %L", `%${isbn}%`));
    if (pageMin) conditionArray.push(format("pages >= %L", pageMin));
    if (pageMax) conditionArray.push(format("pages <= %L", pageMax));
    if (priceMin) conditionArray.push(format("price >= %L", priceMin));
    if (priceMax) conditionArray.push(format("price <= %L", priceMax));

    if (conditionArray.length !== 0)
        queryStr += " WHERE " + conditionArray.join(" AND ");

    // Search in books only first to lessen load on join with genre and author tables
    const initialQuery = await db
        .query({
            text: queryStr,
            rowMode: "array"
        })
        .catch(console.log);

    if (initialQuery.rows.length === 0) {
        console.log("No matches found from query so far.")

        // Query books not listed if they have 'similar' titles
        const similarQuery = await db
            .query(format(
                "SELECT book.book_id, book.title " +
                "FROM book " +
                "WHERE (SELECT levenshtein_less_equal(%L, book.title, 16)) <= 16" +
                "ORDER BY book_id", title))
            .catch(console.log);

        if (similarQuery.rows.length > 0) {
            console.log(`\nBooks with similar titles to "${title}" you may be looking for:`)
            for (const book of similarQuery.rows)
                console.log(`Book ${book["book_id"]}, titled ${book["title"]}`);
        }

        return;
    }

    // Author
    let author = prompt("Author Name > ");

    let authorQueryStr = format(
        `SELECT DISTINCT book_id
            FROM (book_author JOIN author ON book_author.author_id = author.id) 
            WHERE author.name ILIKE %L
            AND cast (book_id as text) IN (%L)`, `%${author}%`, initialQuery.rows.flat());

    const authorQuery = await db
        .query({
            text: authorQueryStr,
            rowMode: "array"
        })
        .catch(console.log);

    if (authorQuery.rows.length === 0) {
        console.log("No matches found.")
        return;
    }

    // Genre
    let genre = prompt("Genre Name > ");

    let genreQueryStr = format(
        `SELECT DISTINCT book_id
            FROM book_genre 
            WHERE genre_name ILIKE %L
            AND cast (book_id as text) IN (%L)`, `%${genre}%`, authorQuery.rows.flat());

    const genreQuery = await db
        .query({
            text: genreQueryStr,
            rowMode: "array"
        })
        .catch(console.log);

    if (genreQuery.rows.length === 0) {
        console.log("No matches found.")
    } else {
        await listBooks(genreQuery.rows);
    }
}

// Rounds input to rounded string, to max 2 decimal places. Used for money outputs
function formatMoney(input) {
    return +parseFloat(input).toFixed(2);
}