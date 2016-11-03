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
collectSpecs : String -> List Spec
collectSpecs txt =
  let
    blockRe = regex "(--[ \\t]+>>>[^\\r\\n]*[\\r\\n]+)+(--[ \\t]+[^|>][^\\r\\n]*[\\r\\n]+)+"
    lineRe = regex "--(\\s+>>>)?(.+)"
    extract m =
      let ex mm spec =
        case mm.submatches of
          (Just _)::(Just t)::_ -> { spec | test = spec.test ++ "\n " ++ t }
          (Nothing)::(Just e)::_ -> { spec | expected = spec.expected ++ "\n " ++ e }
          _ -> spec
      in find All lineRe m.match |> List.foldl ex (newSpec "" "" (countLines m))
    countLines m = List.length <| String.lines <| String.left m.index txt
  in find All blockRe txt |> List.map extract

-- elm-repl requires tailing back slash for handling multi-line statements
evaluationScript : String
evaluationScript = """
import DoctestTempModule__
import Json.Encode exposing (object, list, bool, string, encode)
encode 0 <| list <| \\
  List.map (\\(o,r) -> object [("passed", bool r), ("output", string o)])\\
  DoctestTempModule__.doctestResults_
"""

-- | create temporary module source from original elm source code
createTempModule : String -> List Spec -> String
createTempModule src specs =
  let
    re = regex "^(\\w*\\s*)module\\s+([\\.\\w])+\\s+?exposing\\s+\\([^)]+\\)"
    newheader = "module DoctestTempModule__ exposing (doctestResults_)"
    isport match = (List.head match.submatches) == Just Nothing
    moduledecr match =
      case match.submatches of
        (Just str)::_ -> str ++ newheader
        _ -> newheader
    newmodule = replace (AtMost 1) re moduledecr src
    testDecr = "\n\ndoctestResults_ : List (String, Bool)\ndoctestResults_ = "
    footer = "\n  ["
      ++ (specs |> List.map evalSpec |> String.join "\n  ,") ++ "\n  ]"
    evalSpec {test, expected} = String.join ""
      ["( (toString (", test ,")), (", test, ")==(", expected, ") )"]
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
      , "expected: " ++ (String.trim expected)
      , " but got: " ++ (String.trim output)
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

