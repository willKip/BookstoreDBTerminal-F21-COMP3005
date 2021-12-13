// Resets database schema and fills in seeded, randomized data

const fs = require("fs");
const path = require("path");
const faker = require("faker/locale/en");
const db = require("./index");
const format = require("pg-format");

const initDBSQL = fs.readFileSync(path.join(__dirname, "./initDB.sql"), "utf-8");


function initDB() {
    return db
        .query(initDBSQL)
        .then(() => console.log("Database schema initialized."))
        .catch(console.log);
}

function initUser() {
    let values = [
        ["owner1", "owner1", true],
        ["owner2", "owner2", true],
        ["cust1", "cust1", false],
        ["cust2", "cust2", false]
    ];

    return db
        .query(format('INSERT INTO "user"(id, password, is_owner) VALUES %L RETURNING *',
            values), [])
        .then((res) => console.log(`[${res.rows.length}] user entries initialized.`))
        .catch(console.log);
}

function initPublisherBanking(count = 10) {
    let values = [];

    for (let i = 0; i < count; i++)
        values.push([0]);

    return db
        .query(format("insert into publisher_banking(balance) values %L returning *",
            values), [])
        .then((res) => console.log(`[${res.rows.length}] publisher_banking entries initialized.`))
        .catch(console.log);
}

function initPublisherPhone(count = 10) {
    let values = [];

    for (let i = 0; i < count; i++)
        values.push([faker.phone.phoneNumberFormat()]);

    return db
        .query(format("insert into publisher_phone(phone_number) values %L returning *",
            values), [])
        .then((res) => console.log(`[${res.rows.length}] publisher_phone entries initialized.`))
        .catch(console.log);
}

function initPostalCodeLocation(count = 10) {
    let values = [];

    for (let i = 0; i < count; i++) {
        let zipCode = faker.unique(faker.address.zipCode);
        let city = faker.address.city();
        let state = faker.address.state();

        values.push([zipCode, city, state]);
    }

    return db
        .query(format("INSERT INTO postal_code_location(postal_code, city, province) VALUES %L RETURNING *",
            values), [])
        .then((res) => console.log(`[${res.rows.length}] postal_code_location entries initialized.`))
        .catch(console.log);
}

async function initPublisherAddress(count = 15) {
    let values = [];
    const postalCodes = await db.query({
        rowMode: "array", text: "SELECT postal_code FROM postal_code_location"
    });

    for (let i = 0; i < count; i++) {
        // Select postal code from existing, randomly

        let zipCode = postalCodes.rows[faker.datatype.number(postalCodes.rows.length-1)];
        let streetNum = faker.address.city();
        let streetName = faker.address.streetName();
        let aptNum = faker.datatype.number({min: 101, max: 999});

        values.push([zipCode, streetNum, streetName, aptNum]);
    }

    return db
        .query(format(
            "INSERT INTO publisher_address(postal_code, street_number, street_name, apt_number) VALUES %L RETURNING *",
            values), [])
        .then((res) => console.log(`[${res.rows.length}] publisher_address entries initialized.`))
        .catch(console.log);
}

async function initPublisher(count = 15) {
    let values = [];

    const [banking, address, phone] = await Promise.all([
        await db.query({
            rowMode: "array", text: "SELECT id FROM publisher_banking"
        }),
        await db.query({
            rowMode: "array", text: "SELECT id FROM publisher_address"
        }),
        await db.query({
            rowMode: "array", text: "SELECT id FROM publisher_phone"
        })
    ]);

    for (let i = 0; i < count; i++) {
        // Select keys from existing, randomly
        let bankingID = banking.rows[faker.datatype.number(banking.rows.length-1)];
        let addressID = address.rows[faker.datatype.number(address.rows.length-1)];
        let phoneID = phone.rows[faker.datatype.number(phone.rows.length-1)];
        let name = faker.company.companyName().substring(0, 25);

        values.push([bankingID, addressID, phoneID, name]);
    }

    return db
        .query(format(
            "INSERT INTO publisher(banking_id, address_id, phone_id, name) VALUES %L RETURNING *",
            values), [])
        .then((res) => console.log(`[${res.rows.length}] publisher entries initialized.`))
        .catch(console.log);
}

async function initBook(count = 20) {
    let values = [];

    const publishers = await db.query({
        rowMode: "array", text: "SELECT publisher_id FROM publisher"
    });

    for (let i = 0; i < count; i++) {
        // Select keys from existing, randomly
        let publisherID = publishers.rows[faker.datatype.number(publishers.rows.length-1)];
        let isbn = faker.finance.routingNumber();  // NOT a valid ISBN generator; placeholder values
        let title = `${faker.commerce.productAdjective()} ${faker.animal.dog()}`.substring(0, 30);
        let pages = faker.datatype.number({min: 80, max: 1200});
        let price = faker.datatype.number({min: 5, max: 1200, precision: 0.01});
        let publisherPercent = faker.datatype.number({min: 0, max: 0.5, precision: 0.01});
        let stock = faker.datatype.number({min: 10, max: 50});

        values.push([publisherID, isbn, title, pages, price, publisherPercent, stock]);
    }

    return db
        .query(format(
            "INSERT INTO book(publisher_id, isbn, title, pages, price, publisher_percent, stock) VALUES %L RETURNING *",
            values), [])
        .then((res) => console.log(`[${res.rows.length}] book entries initialized.`))
        .catch(console.log);
}

async function initOrder(count = 2) {
    let values = [];

    // Retrieve enum values of order_status enum
    const orderStatuses = await db.query({
        rowMode: "array", text: "SELECT to_json (enum_range(null::order_status))"
    });

    let orderStatusArray = orderStatuses.rows[0][0];

    for (let i = 0; i < count; i++) {
        // Select order status from enum, randomly

        let orderNum = 10000 + i;
        let orderStatus = orderStatusArray[faker.datatype.number(orderStatusArray.length-1)];
        let billingInfo = `${faker.address.city()}, ${faker.address.state()}`.substring(0, 30);
        let shippingInfo = `${faker.address.city()}, ${faker.address.state()}`.substring(0, 30);

        values.push([orderNum, orderStatus, billingInfo, shippingInfo]);
    }

    return db
        .query(format('INSERT INTO "order"(order_num, status, billing_info, shipping_info) VALUES %L RETURNING *',
            values), [])
        .then((res) => console.log(`[${res.rows.length}] order entries initialized.`))
        .catch(console.log);
}

function initAuthor(count = 20) {
    let values = [];

    for (let i = 0; i < count; i++) {
        let name = `${faker.name.firstName()} ${faker.name.lastName()}`.substring(0, 25);
        let sales = 0;

        values.push([name, sales]);
    }

    return db
        .query(format("INSERT INTO author(name, sales) VALUES %L RETURNING *",
            values), [])
        .then((res) => console.log(`[${res.rows.length}] author entries initialized.`))
        .catch(console.log);
}

function initGenre(count = 20) {
    let values = [];

    for (let i = 0; i < count; i++) {
        let name = `${faker.unique(faker.lorem.word)}`.substring(0, 15);
        let sales = 0;

        values.push([name, sales]);
    }

    return db
        .query(format("INSERT INTO genre(name, sales) VALUES %L RETURNING *",
            values), [])
        .then((res) => console.log(`[${res.rows.length}] genre entries initialized.`))
        .catch(console.log);
}

async function initOrderBook() {
    let values = [];

    const orders = await db.query({
        rowMode: "array", text: 'SELECT order_num FROM "order"'
    });

    const books = await db.query({
        rowMode: "array", text: "SELECT book_id FROM book"
    });

    for (let i = 0; i < orders.rows.length; i++) {
        // Select key from existing, randomly

        let orderNum = orders.rows[i];
        let bookId = books.rows[faker.datatype.number(books.rows.length-1)];
        let quantity = faker.datatype.number({min: 1, max: 20});

        values.push([orderNum, bookId, quantity]);
    }


    return db
        .query(format("INSERT INTO order_book(order_num, book_id, quantity) VALUES %L RETURNING *",
            values), [])
        .then((res) => console.log(`[${res.rows.length}] order_book entries initialized.`))
        .catch(console.log);
}

async function initBookAuthor() {
    let values = [];

    const books = await db.query({
        rowMode: "array", text: "SELECT book_id FROM book"
    });

    const authors = await db.query({
        rowMode: "array", text: "SELECT id FROM author"
    });

    // Book participation is total in this relation. Assign random author id for all books at least once.
    // Books may have multiple authors.
    for (let i = 0; i < books.rows.length; i++) {
        // Select keys from existing, randomly
        let bookId = books.rows[i];
        let authorId = authors.rows[faker.datatype.number(authors.rows.length-1)];

        values.push([bookId, authorId]);
    }

    values.push([1, 12])

    return db
        .query(format("INSERT INTO book_author(book_id, author_id) VALUES %L RETURNING *",
            values), [])
        .then((res) => console.log(`[${res.rows.length}] book_author entries initialized.`))
        .catch(console.log);
}

async function initBookGenre() {
    let values = [];

    const books = await db.query({
        rowMode: "array", text: "SELECT book_id FROM book"
    });

    const genres = await db.query({
        rowMode: "array", text: "SELECT name FROM genre"
    });

    // Book participation is total in this relation. Assign random genre id for all books
    for (let i = 0; i < books.rows.length; i++) {
        // Select keys from existing, randomly
        let bookId = books.rows[i];
        let genreName = genres.rows[faker.datatype.number(genres.rows.length-1)];

        values.push([bookId, genreName]);
    }

    return db
        .query(format("INSERT INTO book_genre(book_id, genre_name) VALUES %L RETURNING *",
            values), [])
        .then((res) => console.log(`[${res.rows.length}] book_genre entries initialized.`))
        .catch(console.log);
}

// TODO: better way to write this? functionalize?
if (require.main === module) {
    console.log("Initializing lookInnaBook DB...");
    faker.seed(3005);   // Seed guarantees consistent example data creation

    initDB().then(
        () => initUser().catch(err => {
            console.log("ERROR: problem with initUser(): " + err.message);
        })
    ).then(
        () => initPostalCodeLocation()
    ).then(
        () => initPublisherBanking()
    ).then(
        () => initPublisherPhone()
    ).then(
        () => initPublisherAddress()
    ).then(
        () => initOrder().catch(err => {
            console.log("ERROR: problem with initOrder(): " + err.message);
        })
    ).then(
        () => initAuthor().catch(err => {
            console.log("ERROR: problem with initAuthor(): " + err.message);
        })
    ).then(
        () => initGenre().catch(err => {
            console.log("ERROR: problem with initGenre(): " + err.message);
        })
    ).then(
        () => initPublisher().catch(err => {
            console.log("ERROR: problem with initPublisher(): " + err.message);
        })
    ).then(
        () => initBook().catch(err => {
            console.log("ERROR: problem with initBook(): " + err.message);
        })
    ).then(
        () => initOrderBook().catch(err => {
            console.log("ERROR: problem with initOrderBook(): " + err.message);
        })
    ).then(
        () => initBookAuthor().catch(err => {
            console.log("ERROR: problem with initBookAuthor(): " + err.message);
        })
    ).then(
        () => initBookGenre().catch(err => {
            console.log("ERROR: problem with initBookGenre(): " + err.message);
        })
    ).then(() => db.end());
}