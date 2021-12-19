-- Ensures book stocks never fall below a certain threshold
CREATE TRIGGER book_restock
    AFTER UPDATE
    ON book
    FOR EACH ROW
EXECUTE FUNCTION restock();