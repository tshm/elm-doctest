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
newSpec test expected line =
    Spec test expected line "" False



-- | This will correct specs from given Elm source code
-- TODO: this part of the code is very ineffecient.  Has to be fixed.


collectSpecs : String -> ( String, List Spec )
collectSpecs src =
    let
        blockCommentRegex =
            regex "{-(.|\\n)*?-}"

        evaluationMatcher =
            "((--[\\t ]*)>>>.+(\\r\\n?|\\n))+"

        expectedMatcher =
            "(\\2(?!>>>).+\\3)*"

        testBlockRegex =
            regex (evaluationMatcher ++ expectedMatcher)

        lineMatcher =
            regex "(?:--)?([\\t ]*>>>)?(.+)"

        replacementStr { test, expected, line } =
            if String.isEmpty expected then
                String.trimLeft test
            else
                String.join ""
                    [ "expression_"
                    , toString line
                    , " = "
                    , test
                    , "expected_"
                    , toString line
                    , " = "
                    , expected
                    ]

        extractSpecs { match, index } =
            let
                constructSpec { submatches } spec =
                    case submatches of
                        (Just _) :: (Just t) :: _ ->
                            { spec | test = spec.test ++ t ++ "\n" }

                        Nothing :: (Just e) :: _ ->
                            { spec | expected = spec.expected ++ e ++ "\n" }

                        _ ->
                            spec
            in
                find All lineMatcher match
                    |> List.foldl constructSpec (newSpec "" "" (countLines index))
                    |> \spec -> { spec | test = spec.test, expected = spec.expected }

        countLines index =
            String.left index src |> String.lines |> List.length

        modifiedSrc =
            replace All blockCommentRegex lineCommentify src

        lineCommentify { match } =
            String.lines match
                |> List.map (replace All (regex "({-|-})") (always "--"))
                |> List.map (\line -> "-- " ++ line)
                |> String.join "\n"
    in
        ( replace All testBlockRegex (replacementStr << extractSpecs) modifiedSrc
        , find All testBlockRegex modifiedSrc
            |> List.map extractSpecs
            |> List.filter (\spec -> not <| String.isEmpty spec.expected)
        )


evalHeader : String -> String
evalHeader modname =
    let
        first =
            """
import Json.Decode
import Json.Encode as J_
"""

        targetImport =
            "import " ++ modname ++ " exposing (..)"

        eval =
            """
J_.encode 0 <| J_.list <| List.map \\
  (\\(o,r) -> J_.object [("passed", J_.bool r), ("output", J_.string o)]) <|\\
"""
    in
        first ++ targetImport ++ eval



-- |
-- >>> getModuleName "./src/Test.elm"
-- "DoctestTempModule__src_Test_elm"
--
-- >>> getModuleName ".\\src\\TestA.elm"
-- "DoctestTempModule__src_TestA_elm"
--
-- >>> getModuleName "TestB.elm"
-- "DoctestTempModule__TestB_elm"
--


getModuleName : String -> String
getModuleName filename =
    filename
        |> String.map
            (\c ->
                if List.member c [ '/', '\\', '.' ] then
                    ' '
                else
                    c
            )
        |> String.words
        |> String.join "_"
        |> String.split ".elm"
        |> List.head
        |> Maybe.withDefault ""
        |> (\s -> "DoctestTempModule__" ++ s)



-- elm-repl requires tailing back slash for handling multi-line statements


evaluationScript : String -> List Spec -> ( String, String )
evaluationScript filename specs =
    let
        testCaseArray =
            "  ["
                ++ (List.map evalSpec specs |> String.join "\n  ,")
                ++ "\n  ]"

        evalSpec { test, expected, line } =
            let
                num =
                    toString line
            in
                String.join ""
                    [ "( (toString expression_"
                    , num
                    , ")"
                    , ", (expression_"
                    , num
                    , " == "
                    , "expected_"
                    , num
                    , "))"
                    ]

        header =
            evalHeader moduleName

        moduleName =
            getModuleName filename
    in
        ( header ++ (testCaseArray |> String.lines |> String.join "\\\n")
        , moduleName
        )



-- | create temporary module source from original elm source code


createTempModule : String -> String -> List Spec -> String
createTempModule modulename src specs =
    let
        modulePart =
            "^(\\w*\\s*)module\\s+([\\.\\w])+"

        exposingPart =
            "(\\s+?exposing\\s+\\(([^()]|\\([^()]*\\))+\\))?"

        moduleRe =
            regex (modulePart ++ exposingPart)

        newheader =
            "module " ++ modulename ++ " exposing (..)\n"

        isport match =
            (List.head match.submatches) == Just Nothing

        moduledecr match =
            case match.submatches of
                (Just str) :: _ ->
                    str ++ newheader

                _ ->
                    newheader

        replacedSrc =
            replace (AtMost 1) moduleRe moduledecr src

        -- even supports the case where there is no module declaration
    in
        if replacedSrc == src then
            newheader ++ src
        else
            replacedSrc



-- | make human readable report
-- >>> createReport "Test.elm" [Spec "3+1" "4" 1 "4" True]
-- Report "Examples: 1  Failures: 0" False
--
-- >>> createReport "Test.elm" [Spec "3+1" "3" 1 "4" False]
-- Report
--   ( "### Failure in Test.elm:1: expression 3+1\n"
--   ++ "expected: 3\n but got: 4\nExamples: 1  Failures: 1") True
--


createReport : String -> List Spec -> Report
createReport filename specs =
    let
        failures =
            List.filter (not << .passed) specs

        summary =
            String.join "  "
                [ "Examples: " ++ (toString <| List.length specs)
                , "Failures: " ++ (toString <| List.length failures)
                ]

        reports =
            failures |> List.map reportFailure

        reportFailure { test, expected, line, passed, output } =
            String.join "\n"
                [ "### Failure in "
                    ++ filename
                    ++ ":"
                    ++ (toString line)
                    ++ ": expression "
                    ++ test
                , "expected: " ++ (String.trim expected)
                , " but got: " ++ (String.trim output)
                , ""
                ]
    in
        Report (String.join "\n" reports ++ summary) (not <| List.isEmpty failures)



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
    let
        decoder =
            Json.Decode.list <|
                Json.Decode.map2 Output
                    (Json.Decode.field "output" string)
                    (Json.Decode.field "passed" bool)
    in
        Result.withDefault [] <| decodeString decoder txt



-- | merge outputs into spec list
-- >>> mergeResultIntoSpecs [Spec "1+2" "3" 1 "3" True] [Output "3" True]
-- [Spec "1+2" "3" 1 "3" True]
--


mergeResultIntoSpecs : List Spec -> List Output -> List Spec
mergeResultIntoSpecs specs outputs =
    let
        merge spec { expression, passed } =
            { spec | output = expression, passed = passed }
    in
        List.map2 merge specs outputs



-- | parse and merge raw output string into spec list


mergeRawOutputIntoSpecs : List Spec -> String -> List Spec
mergeRawOutputIntoSpecs specs txt =
    mergeResultIntoSpecs specs <| parseOutput txt



-- | create report from raw output


createReportFromOutput : String -> List Spec -> String -> Report
createReportFromOutput filename specs output =
    let
        resultSpecs =
            mergeRawOutputIntoSpecs specs output
    in
        createReport filename resultSpecs
