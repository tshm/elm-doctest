[![Build Status](https://semaphoreci.com/api/v1/tshm/elm-doctest/branches/master/badge.svg)](https://semaphoreci.com/tshm/elm-doctest)
[![npm version](https://badge.fury.io/js/elm-doctest.svg)](https://badge.fury.io/js/elm-doctest)

# elm-doctest
doctest runner against Elm-lang source files

## installation
```shell
npm install elm-doctest
```
It depends on `elm` and assumes that `elm-make` and `elm-repl` are available
either via systemwide installation or npm module installation.
Make sure `elm-make` succeeds with your elm source files.

## how does it work?
It utilizes `elm-repl` for expression evaluation and compare the values
against the expected value.
(It does not comapre stringified values like haskell doctest does via
GHCi outputs.)

It only evaluates the expressions that follows `-- >>>`
(i.e. Elm comment symbol followed by space and three LT chars
until end of the line)
and the expression on the next line after `-- `.

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

```
Usage: elm-doctest [--watch] [--help] [--elm-repl-path PATH]
                   [--pretest CMD] FILES...
  run doctest against given Elm files

Available options:
  -h,--help             Show this help text
  --pretest CMD         command to run before doc-test
  --elm-repl-path PATH  Path to elm-repl executable
  -w,--watch            Watch and run tests when target files get updated
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

 processing: test/TestData/TestFail.elm
### Failure in test/TestData/TestFail.elm:10: expression
  greetingTo "World"
expected: "Konnichiwa World"
 but got: "Hello World"
Examples: 3  Failures: 1
```

## limitation

As it utilizes `elm-repl`, the script must run inside
`elm-repl`.
For example, code which imports `elm-lang/navigation@1.0.0`
module cannot be tested.

Also, make sure elm-make runs without error.
You can auto run elm-make by using `--pretest` command-line
option.


## license

MIT

