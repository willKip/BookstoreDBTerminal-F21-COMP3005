# LookInnaBook Bookstore Terminal

Final project for the F21 COMP 3005 A course at Carleton University, Ottawa.

A command line application written in JavaScript, capable of populating a PostgreSQL database with (seeded) randomized data and interfacing with the data, simulating interactive owner and user interfaces. Tested in Windows 10.

## Table of Contents

- [Installation](#installation)
  - [You’ll Need](#youll-need)
  - [Node Dependencies](#node-dependencies)
  - [How To Use](#how-to-use)

- [Features and Testing](#features-and-testing)
  - [General](#general)
  - [User (Customer) Terminal](#user-customer-terminal)
  - [Owner Terminal](#owner-terminal)

- [Design Decisions](#design-decisions)

## Installation

### You’ll Need

- [Git](https://git-scm.com/)
- [PostgreSQL 13.4](https://www.postgresql.org/) or higher
- [npm](https://www.npmjs.com/)
- [Node.js](https://nodejs.org/)

### Node Dependencies

- [faker.js](https://www.npmjs.com/package/faker) - Fake data generator to populate DB
- [@types/faker](https://www.npmjs.com/package/@types/faker) - Type definitions for [faker.js](https://www.npmjs.com/package/faker)
- [node-postgres](https://www.npmjs.com/package/pg) - PostgreSQL client for Node.js
- [node-pg-format](https://www.npmjs.com/package/pg-format) - Node.js implementation of PostgreSQL `format()`, for creating injection-proof SQL queries dynamically
- [pgtools](https://www.npmjs.com/package/pgtools) - Node.js implementation of PostgreSQL `createdb` and `dropdb`
- [prompt-sync](https://www.npmjs.com/package/prompt-sync) - Synchronous prompting library to get user input from the command line

### How To Use

```
# Clone repository to current directory
git clone https://github.com/willKip/BookstoreDBTerminal-F21-COMP3005

# Move into created folder
cd BookstoreDBTerminal-F21-COMP3005

# IMPORTANT: Check the pgConfig.json file and input correct Postgres connection information

# Install dependencies
npm install

# Initialize Postgres DB and populate with schema and data
npm run dbinit

# Run the user terminal
npm run user

# Run the owner terminal
npm run owner
```

## Features and Testing

A list of features required by the project specifications, and how to test each within the application.

### General

| Feature                                             | How to Test                                                  |
| --------------------------------------------------- | ------------------------------------------------------------ |
| Database creation and initialization                | `npm run dbinit` will create a PostgreSQL database named ‘lookInnaBook’, provided an instance is running on the user’s device and correct credentials are provided. Appropriate seeded, randomized data fills the schemas for easy testing. |
| SQL Trigger when book stock < 10; restock 20 copies | As a user, order enough of a certain book to bring its stock below 10; when the order is completed, viewing that book’s information again will show that 20 copies have been added automatically. |

### User (Customer) Terminal

| Feature                           | How to Test                                                  |
| --------------------------------- | ------------------------------------------------------------ |
| Log in                            | Upon app load, user will be prompted to enter ID and PW. `cust1; cust1` or `cust2; cust2` are valid credentials upon DB initialization. Note that the owner accounts are not authorized to browse books like a user, and will be denied access here. |
| Browse books                      | Main Menu > (1) List All Books                               |
| Search books (with attributes)    | Main Menu > (3) Search Books > Enter parameters or skip by leaving blank; relevant books will appear. (e.g. title ‘awesome’ and min. price 500 will yield book ID 3, Awesome Tibetan Spaniel) |
| Select a book                     | Main Menu > (2) Select Book > Input book ID (get by browsing books) |
| View information on a book        | Main Menu > (2) Select Book > Input book ID > (1) View Book Info |
| Add a book to the checkout basket | Main Menu > (2) Select Book > Input book ID > (2) Add To Checkout > Specify how many to be ordered |
| Checkout books in basket          | Main Menu > (4) Checkout > (1) Checkout items in basket > Enter billing and shipping information |
| Empty checkout basket             | Main Menu > (4) Checkout > (2) Empty basket                  |
| Track an order                    | Main Menu > (5) Track Orders > Enter order number. Orders 1000 and 1001 are created as examples and can be tracked. |

### Owner Terminal

| Feature                           | How to Test                                                  |
| --------------------------------- | ------------------------------------------------------------ |
| Log in                            | Upon app load, user will be prompted to enter ID and PW. `owner1; owner1` or `owner2; owner2` are valid credentials upon DB initialization. Note that the user accounts will be denied access here. |
| Browse books                      | Main Menu > (1) List All Books                               |
| Add a book                        | Main Menu > (2) Add Book > Enter desired information, or use the defaults generated. |
| Remove a book                     | Main Menu > (3) Remove Book > Enter ID of book to remove (get by browsing books) |
| View stored publisher information | Main Menu > (4) View Publisher Info                          |
| View reports                      | Main Menu > (5) View Reports > Select from Sales per Genre / Sales per Author / Publisher profits. For meaningful output, test this after doing checkouts from the user terminal. |

## Design Decisions

- User registration is not handled in the application; additional users can be created in the DB initialization script.
- Publisher banking account will be stored as the relation banking_account in the DB for purposes of the application.
- Publisher information can be accessed in the owner terminal.
- Email address of publishers is omitted, as much is shared with phone numbers.
- Dates are not tracked for this application, for simplicity. This removes date-based operations, including the trigger to restock books based on the past month’s sales. Instead, a constant amount of books are restocked.
- Author, genre, and publisher data is preloaded and cannot be changed within the application.
- Order status will be one of [preparing, delivering, shipped]; for the purpose of the application, new orders will have any status randomly assigned to them.
- Billing and shipping information for orders are simplified as basic strings.
