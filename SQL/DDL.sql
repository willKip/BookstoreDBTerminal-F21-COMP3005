create table book
(
    book_id           serial,
    publisher_id      integer,
    isbn              varchar(15),
    title             varchar(15) not null,
    pages             integer check (pages >= 0),
    price             money check (price >= 0),
    publisher_percent numeric(3, 2) default 0,
    stock             integer check (stock >= 0),
    primary key (book_id),

    foreign key (publisher_id) references publisher
        on delete set null
);

create table author
(
    ID    serial,
    name  varchar(15) not null,
    sales integer check (sales >= 0),
    primary key (ID)
);

create table genre
(
    ID    serial,
    name  varchar(15) not null,
    sales integer check (sales >= 0),
    primary key (ID)
);

-- book participation is total: must have at least one author
create table book_author
(
    book_id   integer not null,
    author_id integer,
    primary key (book_id, author_id),
    foreign key (book_id) references book
        on delete no action,
    foreign key (author_id) references author
        on delete set null
);

-- book participation is total: must have at least one genre
create table book_genre
(
    book_id  integer not null,
    genre_id integer,
    primary key (book_id, genre_id),
    foreign key (book_id) references book
        on delete no action,
    foreign key (genre_id) references genre
        on delete set null
);

create table publisher
(
    ID            serial,
    account_id    integer not null,
    name          varchar(15),
    address       varchar(15),
    email_address varchar(20),
    phone_num     varchar(15),

    primary key (ID),
    foreign key (account_id) references banking_account
        on delete set null
);

create table banking_account
(
    ID      serial,
    balance money check (balance >= 0),
    primary key (ID)
);

-- user is a reserved keyword; quote when using
create table "user"
(
    ID       varchar(15) not null,
    password varchar(15) not null,
    is_owner boolean     not null,
    primary key (ID)
);

create table user_checkout
(
    book_id integer,
    user_id integer,
    primary key (book_id, user_id),
    foreign key (book_id) references book
        on delete set null,
    foreign key (user_id) references "user"
        on delete set null
);

-- order is a reserved keyword; quote when using
create table "order"
(
    order_num     serial,
    status_id     integer not null,
    billing_info  varchar(30),
    shipping_info varchar(30),

    primary key (order_num),
    foreign key (status_id) references order_status_type
);

create table order_book
(
    order_num integer not null,
    book_id   integer not null,
    primary key (order_num, book_id),
    foreign key (order_num) references "order",
    foreign key (book_id) references book
);

-- Relation for order status "enum", values are [0: preparing, 1: delivering, 2: shipped]
create table order_status_type
(
    ID          integer not null,
    status_type varchar(15),
    primary key (ID)
);