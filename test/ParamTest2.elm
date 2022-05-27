module ParamTest exposing
    ( A(..)
    , Msg(..)
    , x
    )


type Msg
    = Example



-- |
-- >>> 3 + 1
-- 4
--


type A
    = X
    | Y
    | Z


x : Int -> Int
x i =
    i + 3
