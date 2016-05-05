module Test (name) where

-- |
-- >>> add 3 5
-- 8
--
-- >>> 5 + 4
-- 9
--
-- >>> add 4 5
-- 8
--
-- >>> name
-- "test"
--
-- >>> name
-- "ttt test"
--
add : Int -> Int -> Int
add x y = x + y

name : String
name = "test"

