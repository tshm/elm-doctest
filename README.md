[![Circle CI](https://circleci.com/gh/tshm/elm-doctest.svg?style=svg)](https://circleci.com/gh/tshm/elm-doctest)
[![npm version](https://badge.fury.io/js/elm-doctest.svg)](https://badge.fury.io/js/elm-doctest)

# elm-doctest
doctest runner against Elm-lang source files

## usage

```js
elm-doctest ModuleTobeTested.elm
```

## example

ModuleTobeTested.elm:
```Elm
module ModuleTobeTested where

-- |
-- >>> add 3 5
-- 8
--
-- >>> removeZeros [0, 1, 2, 3, 0]
-- [1, 2, 3]
--
-- >>> greetingTo "World"
-- "Konnichiwa World"
--
add : Int -> Int -> Int
add x y = x + y

greetingTo : String -> String
greetingTo x = "Hello " ++ x

removeZeros : List Int -> List Int
removeZeros = List.filter (\x -> x /= 0)
```

outputs
```
Starting elm-doctest ...
### Failure in Test.elm:10: expression 'greetingTo "World"'
expected: "Konnichiwa World"
 but got: "Hello World"
Examples: 3  Failures: 1
```

## license

MIT


