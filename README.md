[![Circle CI](https://circleci.com/gh/tshm/elm-doctest.svg?style=svg)](https://circleci.com/gh/tshm/elm-doctest)
[![npm version](https://badge.fury.io/js/elm-doctest.svg)](https://badge.fury.io/js/elm-doctest)

# elm-doctest
doctest runner against Elm-lang source files

## installation
```shell
npm install elm-doctest
```
It depends on `elm` runtime and assumes that `elm-make` is available
either via systemwide installation or npm module installation.
Make sure `elm-make` succeeds with your elm source files before
running `elm-doctest`.

## how does it work?
It utilizes `elm-make` and nodejs runtime for elm -> js compilation and
expression evaluation and compare the values against the expected value.
(It does not comapre stringified values like haskell doctest does with
GHCi outputs.)

It only evaluates the expressions that follows `-- >>>`
(i.e. Elm comment symbol followed by space and three LT chars
then the expression)
and the expression on the next line after `-- ` for the
expected value.
It does not support multi-line expression at this moment.

For example, if the comment states:
```Elm
-- >>> 3 * 2
-- 6
```
Then, elm-doctest asks elm-repl to evaluate the
actual code section in the source file and
effectively following expression:
```Elm
(3 * 2) == (6)
```
If value reported by `elm-repl` is `True` then test passes, fail otherwise.

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

evaluation `elm-doctest ModuleTobeTested.elm` outputs
```
Starting elm-doctest ...
### Failure in Test.elm:10: expression 'greetingTo "World"'
expected: "Konnichiwa World"
 but got: "Hello World"
Examples: 3  Failures: 1
```


## license

MIT

