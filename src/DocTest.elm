module DocTest where

import Regex exposing (..)
import String
import Json.Decode exposing (..)
-- import Debug exposing (..)

{-- model for holding spec info -}
type alias Spec =
  { test : String
  , expected : String
  , line : Int
  , output : String
  , result : Bool
  }

{- initially all specs have "False" result.
 - it will be evaluated later in the process.
 -}
newSpec : String -> String -> Int -> Spec
newSpec test expected line = Spec test expected line "" False

-- | This will correct specs from given Elm source code
--
-- >>> collectSpecs "-- >>> test\n-- 8"
-- [newSpec "test" "8" 1]
--
-- >>> collectSpecs "-- >>> test\n-- 8"
-- [Spec "test" "8" 1 "" False]
--
-- >>> collectSpecs "-- >>> test\n-- 8\n-- >>> xxx\n-- 9"
-- [(newSpec "test" "8" 1), (newSpec "xxx" "9" 3)]
--
-- >>> collectSpecs "-- >>> test\n-- 8\n--\n-- >>> xxx\n-- 9"
-- [(newSpec "test" "8" 1), (newSpec "xxx" "9" 4)]
--
collectSpecs : String -> List Spec
collectSpecs txt =
  let
    re = regex "--\\s*>>>\\s*(.+)[\\r\\n]--\\s*([^\\n\\r]+)"
    extract m =
      let (test, expect) = case m.submatches of
        (Just test)::(Just expect)::_ -> (test, expect)
        otherwise -> ("", "")
      in newSpec test expect (getLine m)
    -- count number of lines until found `index`
    getLine m = List.length <| String.lines <| String.left m.index txt
  in find All re txt |> List.map extract 

evaluationScript : String
evaluationScript = """
import DoctestTempModule__
import Json.Encode exposing (object, list, bool, string, encode)
encode 0 <| list <| \\
  List.map (\\(r,o) -> object [("result", bool r), ("output", string o)])\\
  DoctestTempModule__.doctestResults_
"""

-- | create temporary module source from original elm source code
-- >>> createTempModule "module Test where" []
-- "module DoctestTempModule__ where\n\ndoctestResults_ : List (Bool, String)\ndoctestResults_ = []"
--
-- >>> createTempModule "" [newSpec "3+5" "8" 1] |> String.split "\n" |> List.reverse |> List.head
-- Just "doctestResults_ = [((3+5)==(8), (toString (3+5)))]"
--
createTempModule : String -> List Spec -> String
createTempModule src specs =
  let
    re = regex "^ *module(.|\r|\n)*?where"
    newheader = "module DoctestTempModule__ where"
    newmodule = replace (AtMost 1) re (always newheader) src
    testDecr = "\n\ndoctestResults_ : List (Bool, String)\ndoctestResults_ = "
    footer = "[" ++ (specs |> List.map evalSpec |> String.join ", ") ++ "]"
    evalSpec {test, expected} = String.join ""
      ["((", test, ")==(", expected, "), ","(toString (", test ,")))"]
  in newmodule ++ testDecr ++ footer

-- | make human readable report
-- >>> createReport "Test.elm" [Spec "3+1" "4" 1 "4" True]
-- ("Examples: 1  Failures: 0", True)
--
-- >>> createReport "Test.elm" [Spec "3+1" "3" 1 "4" False]
-- ("### Failure in Test.elm:1: expression 3+1\nexpected: 3\n but got: 4\nExamples: 1  Failures: 1", False)
--
createReport : String -> List Spec -> (String, Bool)
createReport filename specs =
  let
    failures = List.filter (not << .result) specs
    summary = String.join "  "
      [ "Examples: " ++ (toString <| List.length specs)
      , "Failures: " ++ (toString <| List.length failures)
      ]
    reports = failures |> List.map formatFailure
    formatFailure {test, expected, line, result, output} = String.join "\n"
      [ "### Failure in " ++ filename ++ ":" ++ (toString line) ++ ": expression " ++ test
      , "expected: " ++ expected
      , " but got: " ++ output
      , ""
      ]
  in (String.join "\n" reports ++ summary, List.length failures == 0)

-- | parse the raw json string which dumped by elm-repl
--
-- >>> parseResult "[]"
-- []
--
-- >>> parseResult "[{\"result\":true, \"output\":\"8\"}]"
-- [("8", True)]
--
-- >>> parseResult "[{\"result\":true, \"output\":\"8\"},{\"result\":false, \"output\":\"3\"}]"
-- [("8", True), ("3", False)]
--
parseResult : String -> List (String, Bool)
parseResult txt =
  let
    decoder = Json.Decode.list
            <| object2 (,) ("output" := string) ("result" := bool)
  in Result.withDefault [] <| decodeString decoder txt

-- | merge result into spec list
-- >>> mergeResultIntoSpecs [Spec "1+2" "3" 1 "3" True] [("3", True)]
-- [Spec "1+2" "3" 1 "3" True]
--
mergeResultIntoSpecs : List Spec -> List (String, Bool) -> List Spec
mergeResultIntoSpecs specs results =
  let
    merge spec (output, flag) = { spec | output = output, result = flag }
  in List.map2 merge specs results

-- | parse and merge raw result string into spec list
mergeRawResultIntoSpecs : List Spec -> String -> List Spec
mergeRawResultIntoSpecs specs txt =
  mergeResultIntoSpecs specs <| parseResult txt

-- | create report from raw result
createReportFromResult : String -> List Spec -> String -> (String, Bool)
createReportFromResult filename specs result =
  let
      resultSpecs = mergeRawResultIntoSpecs specs result
  in createReport filename resultSpecs

