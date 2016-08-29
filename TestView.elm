module TestData exposing
    ( add
    , greetingTo
    , removeZeros
    )

-- |
-- >>> add 3 5
-- 8
--
-- >>> removeZeros [0, 1, 2, 3, 0]
-- [1, 2, 3]
--
-- >>> greetingTo "World"
-- "Hello World"
--
add : Int -> Int -> Int
add x y = x + y

greetingTo : String -> String
greetingTo x = "Hello " ++ x

removeZeros : List Int -> List Int
removeZeros = List.filter (\x -> x /= 0)

