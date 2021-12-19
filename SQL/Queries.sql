-- Many of the queries used below are constructed dynamically in the application.
-- Queries will be written in their fullest forms possible, and pg-format templates
-- will be left in rather than replaced by arbitrary values.

-- Returns the current datetime and timezone; used to confirm connection to DB by application
SELECT NOW();

-- Get all postal codes from the relation.
SELECT postal_code FROM postal_code_location;

-- Queries that get all IDs from the relations. Used for DDL.
SELECT id FROM publisher_banking;
SELECT id FROM publisher_address;
SELECT id FROM publisher_phone;
SELECT publisher_id FROM publisher;
SELECT order_num FROM "order";
SELECT book_id FROM book;
SELECT id FROM author;
SELECT name FROM genre;

-- Get the book tuple with the given ID.
SELECT * FROM book WHERE book_id = %L;

-- Get author names related to the given book ID.
SELECT author.name
FROM book_author JOIN author ON book_author.author_id = author.id
WHERE book_id = %L;

-- Get genre names related to the given book ID.
SELECT book_genre.genre_name
FROM book JOIN book_genre ON book.book_id = book_genre.book_id
WHERE book.book_id = %L;

-- Get the publisher name related to the given book ID.
SELECT publisher.name
FROM book JOIN publisher ON book.publisher_id = publisher.publisher_id
WHERE book.book_id = %L;

-- Get all book tuples with the given IDs, ordered by ID.
SELECT * FROM book
WHERE cast (book_id as text) IN (%L)
ORDER BY book_id;

-- Return the boolean is_owner of a user, provided the user with the ID and PW
-- combination exists.
SELECT is_owner FROM "user" WHERE id = %L AND password = %L;

-- Get all publisher IDs that exist.
SELECT publisher_id FROM publisher;

-- Get all genre names that exist, ordered alphabetically by name.
SELECT name FROM genre ORDER BY name;

-- Get all IDs and names of authors that exist, ordered by ID.
SELECT id, name FROM author ORDER BY id;

-- Insert into the book tuple a new book with specified attributes; ID is
-- automatically assigned by the database. Return the book tuple created.
INSERT INTO book(publisher_id, isbn, title, pages, price, publisher_percent, stock)
VALUES %L RETURNING *;

-- Insert into a book_genre relation a tuple representing a given book's associated genres.
INSERT INTO book_genre(book_id, genre_name) VALUES %L;

-- Insert into a book_author relation a tuple representing a given book's associated authors.
INSERT INTO book_author(book_id, author_id) VALUES %L;

-- Delete the book with the given ID.
DELETE FROM book WHERE book_id = %L;

-- Get all publishers and their relevant information from the specialized view.
SELECT * FROM publisher_info;

-- Get genres where the supplied string is a partial match to the names.
SELECT * FROM genre
WHERE name ILIKE %L
ORDER BY name;

-- Get names and sales of authors where the supplied string is a partial match to the names.
SELECT name, sales FROM author
WHERE name ILIKE %L
ORDER BY name;

-- Get names and balance of publishers where the supplied string is a partial match to the names.
SELECT name, balance FROM publisher_profits
WHERE name ILIKE %L
ORDER BY name;

-- Retrieve enum values of the order_status enum
SELECT to_json (enum_range(null::order_status));

-- Insert a new order into the relation, returning the order number created
INSERT INTO "order"(status, billing_info, shipping_info)
VALUES (%L) RETURNING order_num;

-- Update stock of the book with the given ID to the given value
UPDATE book SET stock = %L WHERE book_id = %L;

-- Insert into order_book a tuple representing a book included in an order, and its order quantity.
INSERT INTO order_book(order_num, book_id, quantity) VALUES (%L);

-- Add a value to the sales of author tuples relating to the book with the given ID
UPDATE author
SET sales = sales + %L
WHERE id IN (
    SELECT author_id
    FROM book JOIN book_author ON book.book_id = book_author.book_id
    WHERE book.book_id = %L);

-- Add a value to the sales of genre tuples relating to the book with the given ID
UPDATE genre
SET sales = sales + %L
WHERE name IN (
    SELECT genre_name
    FROM book JOIN book_genre ON book.book_id = book_genre.book_id
    WHERE book.book_id = %L);

-- Given a book ID, update its publisher's account with the appropriate amount
-- of profit from selling the given amount of books
UPDATE publisher_banking
SET balance = balance + %L * bookInfo.price * bookInfo.publisher_percent
FROM (
    SELECT price, publisher_percent
    FROM book
    WHERE book_id = %L) as bookInfo
WHERE id = (
    SELECT banking_id
    FROM book JOIN publisher ON book.publisher_id = publisher.publisher_id
    WHERE book_id = %L);

-- Select all orders with the given order number, not including book information
SELECT * FROM "order" WHERE order_num = %L;

-- Select all orders with the given order number, along with their related books
SELECT * FROM order_book NATURAL JOIN book WHERE order_book.order_num = %L;

-- Find book IDs with attributes adhering to the given conditions. Less conditions
-- may be enforced when the query is made by the application, depending on user input.
SELECT DISTINCT book_id
FROM book
WHERE title ILIKE %L
  AND isbn ILIKE %L
  AND pages >= %L
  AND pages <= %L
  AND price >= %L
  AND price <= %L;

-- From a given pool of book IDs, find the IDs of books with author names that
-- are partially matched by the given string
SELECT DISTINCT book_id
FROM (book_author JOIN author ON book_author.author_id = author.id)
WHERE author.name ILIKE %L
  AND cast (book_id as text) IN (%L);

-- From a given pool of book IDs, find the IDs of books with genre names that
-- are partially matched by the given string
SELECT DISTINCT book_id
FROM book_genre
WHERE genre_name ILIKE %L
  AND cast (book_id as text) IN (%L);

-- Find IDs and titles of books with a levenshtein distance less than 16 to the
-- given string
SELECT book.book_id, book.title
FROM book
WHERE (SELECT levenshtein_less_equal(%L, book.title, 16)) <= 16
ORDER BY book_id