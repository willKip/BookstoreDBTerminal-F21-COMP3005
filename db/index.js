const {Pool} = require("pg");
const format = require("pg-format");
const prompt = require("prompt-sync")({sigint: true});
const pgConfig = require("../pgConfig.json")

// Connect to DB
const pool = new Pool({
    user: pgConfig.user,
    password: pgConfig.password,
    host: pgConfig.host,
    port: pgConfig.port,
    database: "lookInnaBook"
});

// Queries DB for system time, used for checking connection
async function getDBConnectionTime() {
    const nowQuery = await pool.query("SELECT NOW()");
    return nowQuery.rows[0]["now"];
}

// Generates object containing all directly relevant properties of the book with targetId.
// {id, title, authors, genres, publisher, pages, price, isbn, stock}
async function getBookObject(targetId) {
    const bookQuery = await pool
        .query(format("SELECT * FROM book WHERE book_id = %L", targetId))
        .catch(console.log);

    if (bookQuery.rows.length === 0)
        return null;

    const authorQuery = await pool.query({
        text: format(
            `SELECT author.name 
                FROM book_author JOIN author 
                ON book_author.author_id = author.id
                WHERE book_id = %L`,
            targetId),
        rowMode: "array"
    }).catch(console.log);

    const genreQuery = await pool.query({
        text: format(
            `SELECT book_genre.genre_name 
                FROM book JOIN book_genre 
                ON book.book_id = book_genre.book_id 
                WHERE book.book_id = %L`,
            targetId),
        rowMode: "array"
    }).catch(console.log);

    const publisherQuery = await pool.query({
        text: format(
            `SELECT publisher.name
                    FROM book JOIN publisher
                    ON book.publisher_id = publisher.publisher_id
                    WHERE book.book_id = %L`,
            targetId),
        rowMode: "array"
    }).catch(console.log);

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

// List books by ID with relevant information; if an array is supplied,
// only books with IDs in the array will be displayed.
async function listBooks(bookIds = []) {
    let queryText = "SELECT * FROM book";

    if (bookIds.length > 0)
        queryText += format(" WHERE cast (book_id as text) IN (%L)", bookIds.flat());

    queryText += " ORDER BY book_id";

    const bookQuery = await pool
        .query(queryText)
        .catch(console.log);

    console.log("\nDisplaying books.")
    console.log("ID; Title; Authors; Genres; Publisher; Pages; ISBN; Stock")

    for (const book of bookQuery.rows) {
        let bookInfo = await getBookObject(book["book_id"])
        let bookString = "";
        bookString += String(bookInfo.id).padStart(2, " "); // ID
        bookString += "; " + `${bookInfo.title}`.padEnd(30, " "); // Title
        bookString += "; " + bookInfo.authors.join(", ").padEnd(20, " "); // Name(s) of book author(s)
        bookString += "; " + bookInfo.genres.join(", ").padEnd(15, " "); // Name(s) of book genre(s)
        bookString += "; " + `${bookInfo.publisher}`.padEnd(26, " "); // Publisher
        bookString += ";" + `${bookInfo.pages}`.padStart(5, " "); // Pages
        bookString += ";" + `${bookInfo.isbn}`.padStart(10, " "); // ISBN
        bookString += `; ${bookInfo.stock} left`; // Stock

        console.log(bookString);  // Print book information string
    }
}

// Prompts user repeatedly to obtain a valid integer input or an empty (falsy) input
function getInteger(ask) {
    let result;
    do {
        result = prompt(ask);
    } while (isNaN(result) || !Number.isInteger(Number(result)))

    return Number(result);
}

module.exports = {
    query: (text, params, callback) => {
        // console.log(text);
        return pool.query(text, params, callback);
    },
    end: () => {
        return pool.end();
    },
    getDBConnectionTime, getBookObject, listBooks, getInteger
};