module TestFail2 exposing (..)

{--|

>>> removeZeros [0, 1, 2, 3, 0]a
[1, 2, 3]

>>> greetingTo "World"
"Hello World"

>>> let
>>>   x = 3
>>>   y = 2
>>> in x + y
5

--}


add : Int -> Int -> Int
add x y =
    x + y


greetingTo : String -> String
greetingTo x =
    "Hello " ++ x


removeZeros : List Int -> List Int
removeZeros =
    List.filter (\x -> x /= 0)
