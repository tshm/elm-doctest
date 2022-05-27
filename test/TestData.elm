module TestData exposing (..)

import TestData.TestFail as F



-- |
-- >>> F.greetingTo "test"
-- "Hello test"
-- >>> add 3 5
-- 8
--
-- >>> removeZeros [0, 1, 2, 3, 0]
-- [1, 2, 3]
--
-- >>> greetingTo "World"
-- "Hello World"
--
-- >>>  let
-- >>>    x = 3
-- >>>    y = 2
-- >>>  in x + y
-- 5
--


add : Int -> Int -> Int
add x y =
    x + y


greetingTo : String -> String
greetingTo x =
    "Hello " ++ x


removeZeros : List Int -> List Int
removeZeros =
    List.filter (\x -> x /= 0)
