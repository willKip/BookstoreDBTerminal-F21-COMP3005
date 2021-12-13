create type order_status as enum ('preparing', 'delivering', 'shipped');

create table postal_code_location
(
    postal_code varchar(10) not null,
    city        varchar(15),
    province    varchar(15),

    primary key (postal_code)
);

create table publisher_banking
(
    ID      serial,
    balance numeric(15,4) check (balance >= 0),
    primary key (ID)
);

create table publisher_address
(
    ID            serial,
    postal_code   varchar(15) not null,
    street_number varchar(15),
    street_name   varchar(15),
    apt_number    varchar(15),

    primary key (ID),
    foreign key (postal_code) references postal_code_location (postal_code)
        on delete no action
);


create table publisher_phone
(
    ID    serial,
    sales integer not null,
    primary key (ID)
);

create table publisher
(
    ID         serial,
    banking_id integer not null,
    address_id integer not null,
    phone_id   integer not null,
    name       varchar(15),

    primary key (ID),
    foreign key (banking_id) references publisher_banking (ID)
        on delete no action,
    foreign key (address_id) references publisher_address (ID)
        on delete no action,
    foreign key (phone_id) references publisher_phone (ID)
        on delete no action
);

create table book
(
    book_id           serial,
    publisher_id      integer,
    isbn              varchar(15),
    title             varchar(15) not null,
    pages             integer check (pages >= 0),
    price             numeric(15,4) check (price >= 0),
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

-- order is a reserved keyword; quote when using
create table "order"
(
    order_num     serial,
    status        order_status,
    billing_info  varchar(30),
    shipping_info varchar(30),

    primary key (order_num)
);

-- book participation is total: must have at least one author
create table book_author
(
    book_id   integer not null,
    author_id integer,
    primary key (book_id, author_id),
    foreign key (book_id) references book
        on delete no action,
    foreign key (author_id) references author (ID)
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
    foreign key (genre_id) references genre (ID)
        on delete set null
);


create table order_book
(
    order_num integer,
    book_id   integer,
    primary key (order_num, book_id),
    foreign key (order_num) references "order" (order_num)
        on delete set null,
    foreign key (book_id) references book (book_id)
        on delete set null
);

-- user is a reserved keyword; quote when using
create table "user"
(
    ID       varchar(15) not null,
    password varchar(15) not null,
    is_owner boolean     not null,
    primary key (ID)
);