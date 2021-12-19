-- Trigger function; adds a fixed amount (20) of stock to books with stock less than 10
CREATE FUNCTION restock() RETURNS TRIGGER AS
$restock$
BEGIN
    IF (new.stock < 10) THEN
        UPDATE book
        SET stock = stock + 20
        WHERE book_id = new.book_id ;
    END IF;
    RETURN new;
END;
$restock$ LANGUAGE 'plpgsql';