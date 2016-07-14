module DocTest exposing (..)

import Regex exposing (..)
import String
import Json.Decode exposing (..)

-- | model for holding spec info
type alias Spec =
  { test : String
  , expected : String
  , line : Int
  , output : String
  , passed : Bool
  }

-- | model for report
type alias Report =
  { text : String
  , failed : Bool
  }

-- | model for output
type alias Output =
  { expression : String
  , passed : Bool
  }

-- | spec constructor.
-- initially all specs have "False" result.
-- it will be evaluated later in the process.
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
    extract m = case m.submatches of
      (Just test)::(Just expect)::_ -> newSpec test expect (countLines m)
      otherwise -> newSpec "" "" (countLines m)
    countLines m = List.length <| String.lines <| String.left m.index txt
  in find All re txt |> List.map extract 

-- elm-repl requires tailing back slash for handling multi-line statements
evaluationScript : String
evaluationScript = """
import DoctestTempModule__
import Json.Encode exposing (object, list, bool, string, encode)
encode 0 <| list <| \\
  List.map (\\(r,o) -> object [("passed", bool r), ("output", string o)])\\
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
-- Report "Examples: 1  Failures: 0" False
--
-- >>> createReport "Test.elm" [Spec "3+1" "3" 1 "4" False]
-- Report "### Failure in Test.elm:1: expression 3+1\nexpected: 3\n but got: 4\nExamples: 1  Failures: 1" True
--
createReport : String -> List Spec -> Report
createReport filename specs =
  let
    failures = List.filter (not << .passed) specs
    summary = String.join "  "
      [ "Examples: " ++ (toString <| List.length specs)
      , "Failures: " ++ (toString <| List.length failures)
      ]
    reports = failures |> List.map reportFailure
    reportFailure {test, expected, line, passed, output} = String.join "\n"
      [ "### Failure in " ++ filename ++ ":" ++ (toString line)
       ++ ": expression " ++ test
      , "expected: " ++ expected
      , " but got: " ++ output
      , ""
      ]
  in Report (String.join "\n" reports ++ summary) (not <| List.isEmpty failures)

-- | parse the raw json string which dumped by elm-repl
--
-- >>> parseOutput "[]"
-- []
--
-- >>> parseOutput "[{\"passed\":true, \"output\":\"8\"}]"
-- [Output "8" True]
--
-- >>> parseOutput "[{\"passed\":true, \"output\":\"8\"},{\"passed\":false, \"output\":\"3\"}]"
-- [Output "8" True, Output "3" False]
--
parseOutput : String -> List Output
parseOutput txt =
  let decoder = Json.Decode.list
              <| object2 Output ("output" := string) ("passed" := bool)
  in Result.withDefault [] <| decodeString decoder txt

-- | merge outputs into spec list
-- >>> mergeResultIntoSpecs [Spec "1+2" "3" 1 "3" True] [Output "3" True]
-- [Spec "1+2" "3" 1 "3" True]
--
mergeResultIntoSpecs : List Spec -> List Output -> List Spec
mergeResultIntoSpecs specs outputs =
  let
    merge spec {expression, passed} = { spec | output = expression, passed = passed }
  in List.map2 merge specs outputs

-- | parse and merge raw output string into spec list
mergeRawOutputIntoSpecs : List Spec -> String -> List Spec
mergeRawOutputIntoSpecs specs txt =
  mergeResultIntoSpecs specs <| parseOutput txt

-- | create report from raw output
createReportFromOutput : String -> List Spec -> String -> Report
createReportFromOutput filename specs output =
  let
      resultSpecs = mergeRawOutputIntoSpecs specs output
  in createReport filename resultSpecs

