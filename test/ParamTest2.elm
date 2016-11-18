module ParamTest exposing
  ( Msg(Example)
  , x
  , A(..)
  )
type Msg = Example

-- |
-- >>> 3 + 1
-- 4
--

type A = X | Y | Z

x : Int -> Int
x i = i + 3

