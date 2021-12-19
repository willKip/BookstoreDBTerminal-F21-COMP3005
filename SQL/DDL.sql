-- Many of the queries used below are constructed dynamically in the application.
-- Queries will be written in their fullest forms possible, and pg-format templates
-- will be left in rather than replaced by arbitrary values.

-- drop database schema to reset
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;

-- restore default permissions
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO PUBLIC;

-- install module for fuzzy string matching
CREATE EXTENSION fuzzystrmatch;

-- Enum storing all possible order statuses
CREATE TYPE order_status AS ENUM ('preparing', 'delivering', 'shipped');

CREATE TABLE postal_code_location
(
    postal_code VARCHAR(10) NOT NULL,
    city        VARCHAR(25),
    province    VARCHAR(25),
    PRIMARY KEY (postal_code)
);

CREATE TABLE publisher_banking
(
    id      SERIAL,
    balance NUMERIC(15, 4) CHECK (balance >= 0),
    PRIMARY KEY (id)
);

CREATE TABLE publisher_address
(
    id            SERIAL,
    postal_code   VARCHAR(10) NOT NULL,
    street_number VARCHAR(10),
    street_name   VARCHAR(25),
    apt_number    VARCHAR(10),

    PRIMARY KEY (id),
    FOREIGN KEY (postal_code) REFERENCES postal_code_location (postal_code)
        ON DELETE NO ACTION
);


CREATE TABLE publisher_phone
(
    id           SERIAL,
    phone_number VARCHAR(15),
    PRIMARY KEY (id)
);

CREATE TABLE publisher
(
    publisher_id SERIAL,
    banking_id   INTEGER NOT NULL,
    address_id   INTEGER NOT NULL,
    phone_id     INTEGER NOT NULL,
    name         VARCHAR(25),

    PRIMARY KEY (publisher_id),
    FOREIGN KEY (banking_id) REFERENCES publisher_banking (id)
        ON DELETE NO ACTION,
    FOREIGN KEY (address_id) REFERENCES publisher_address (id)
        ON DELETE NO ACTION,
    FOREIGN KEY (phone_id) REFERENCES publisher_phone (id)
        ON DELETE NO ACTION
);

CREATE TABLE book
(
    book_id           SERIAL,
    publisher_id      INTEGER NOT NULL,
    isbn              VARCHAR(15),
    title             VARCHAR(30) NOT NULL,
    pages             INTEGER CHECK (pages >= 0),
    price             NUMERIC(15, 4) CHECK (price >= 0),
    publisher_percent NUMERIC(3, 2) DEFAULT 0,
    stock             INTEGER CHECK (stock >= 0),
    PRIMARY KEY (book_id),

    FOREIGN KEY (publisher_id) REFERENCES publisher
        ON DELETE SET NULL
);

CREATE TABLE author
(
    id    SERIAL,
    name  VARCHAR(25) NOT NULL,
    sales INTEGER CHECK (sales >= 0),
    PRIMARY KEY (id)
);

CREATE TABLE genre
(
    name  VARCHAR(15) NOT NULL,
    sales INTEGER CHECK (sales >= 0),
    PRIMARY KEY (name)
);

-- order is a reserved keyword; quote when using
-- order_num starts from 1000 instead of 1.
CREATE TABLE "order"
(
    order_num     INTEGER GENERATED ALWAYS AS IDENTITY ( START WITH 1000 ),
    status        order_status,
    billing_info  VARCHAR(30),
    shipping_info VARCHAR(30),

    PRIMARY KEY (order_num)
);

-- book participation is total: books must have at least one author
CREATE TABLE book_author
(
    book_id   INTEGER NOT NULL,
    author_id INTEGER NOT NULL,
    PRIMARY KEY (book_id, author_id),
    FOREIGN KEY (book_id) REFERENCES book
        ON DELETE CASCADE,
    FOREIGN KEY (author_id) REFERENCES author (id)
        ON DELETE CASCADE
);

-- book participation is total: must have at least one genre
CREATE TABLE book_genre
(
    book_id    INTEGER     NOT NULL,
    genre_name VARCHAR(15) NOT NULL,
    PRIMARY KEY (book_id, genre_name),
    FOREIGN KEY (book_id) REFERENCES book
        ON DELETE CASCADE,
    FOREIGN KEY (genre_name) REFERENCES genre (name)
        ON DELETE SET NULL
);

CREATE TABLE order_book
(
    order_num INTEGER,
    book_id   INTEGER,
    quantity  INTEGER CHECK (quantity >= 0),
    PRIMARY KEY (order_num, book_id),
    FOREIGN KEY (order_num) REFERENCES "order" (order_num)
        ON DELETE CASCADE,
    FOREIGN KEY (book_id) REFERENCES book (book_id)
        ON DELETE CASCADE
);

-- user is a reserved keyword; quote when using
CREATE TABLE "user"
(
    id       VARCHAR(15) NOT NULL,
    password VARCHAR(15) NOT NULL,
    is_owner BOOLEAN     NOT NULL,
    PRIMARY KEY (id)
);

-- Save a new user.
INSERT INTO "user"(id, password, is_owner) VALUES %L RETURNING *;

-- Create a publisher account. Account number is assigned by the DB.
INSERT INTO publisher_banking(balance) VALUES %L RETURNING *;

-- Save a phone number for a publisher.
INSERT INTO publisher_phone(phone_number) VALUES %L RETURNING *;

-- Save a postal code and its associated locations.
INSERT INTO postal_code_location(postal_code, city, province) VALUES %L RETURNING *;

-- Create an address for a publisher. ID is assigned by the DB.
INSERT INTO publisher_address(postal_code, street_number, street_name, apt_number) VALUES %L RETURNING *;

-- Create a publisher with the assigned properties.
INSERT INTO publisher(banking_id, address_id, phone_id, name) VALUES %L RETURNING *;

-- Create a book with the assigned properties.
INSERT INTO book(publisher_id, isbn, title, pages, price, publisher_percent, stock) VALUES %L RETURNING *;

-- Create a order with the assigned properties.
INSERT INTO "order"(status, billing_info, shipping_info) VALUES %L RETURNING *;

-- Create an author with the assigned properties.
INSERT INTO author(name, sales) VALUES %L RETURNING *;

-- Create a genre with the assigned properties.
INSERT INTO genre(name, sales) VALUES %L RETURNING *;

-- Create an order with the assigned properties.
INSERT INTO order_book(order_num, book_id, quantity) VALUES %L RETURNING *;

-- Relate a book and an author.
INSERT INTO book_author(book_id, author_id) VALUES %L RETURNING *;

-- Relate a book and a genre.
INSERT INTO book_genre(book_id, genre_name) VALUES %L RETURNING *;

-- View of publishers and their profits
CREATE VIEW publisher_profits AS
SELECT publisher_id, name, balance
FROM publisher JOIN publisher_banking ON publisher.banking_id = publisher_banking.id
ORDER BY publisher_id;

-- View with relevant publisher information aggregated
CREATE VIEW publisher_info AS
SELECT publisher_id,
       publisher.name,
       publisher.banking_id,
       phone_number,
       apt_number,
       street_number,
       street_name,
       city,
       province,
       pa.postal_code
FROM publisher
         JOIN publisher_address pa ON publisher.address_id = pa.id
         JOIN postal_code_location ON pa.postal_code = postal_code_location.postal_code
         JOIN publisher_phone ON publisher_phone.id = publisher.phone_id
ORDER BY publisher_id;