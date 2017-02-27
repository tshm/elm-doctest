port module Main exposing (..)

import DocTest
import String

main : Program Never Model Msg
main =
  Platform.program
    { init = ({ specs = [] }, Cmd.none)
    , update = update
    , subscriptions = subscriptions
    }

type Msg
  = Input SourceCode
  | NewResult TestResult

update : Msg -> Model -> (Model, Cmd Msg)
update msg model =
  case msg of
    Input { code, filename } ->
      let
        (testcode, specs) = DocTest.collectSpecs code
        out =
          { src = DocTest.createTempModule testcode specs
          , runner = DocTest.evaluationScript
          , filename = filename
          }
      in ({ specs = specs }, evaluate out)

    NewResult result ->
      let
        createReport specs { filename, stdout, failed } =
          if failed then DocTest.Report stdout True
          else if List.isEmpty specs    then DocTest.Report "" False
          else if String.isEmpty stdout then DocTest.Report "" False
          else DocTest.createReportFromOutput filename specs stdout
      in (model, report <| createReport model.specs result)

port evaluate : { src: String, runner: String, filename: String } -> Cmd msg
port report : DocTest.Report -> Cmd msg

-- data models
type alias SourceCode = { code : String , filename : String }
type alias TestResult = { stdout : String , filename : String, failed : Bool }
type alias Model =
  { specs : List DocTest.Spec
  }

{--
  data flow
  1. @js: read elm source code
  2. @js: send it to the srccode port
  3. @elm: receive Input message with sourcecode
  4. @elm: extract specs and create eval script
  5. @elm: send eval script back to js via evaluate port
  6. @js: feed eval script into elm-repl and get stdout
  7. @js: send stdout back to elm via result port
  8. @elm: parse stdout and send formatted report string into js
  9. @elm: dump report and exit
--}

subscriptions : Model -> Sub Msg
subscriptions _ =
  Sub.batch
    [ srccode Input
    , result NewResult
    ]

port srccode : (SourceCode -> msg) -> Sub msg
port result : (TestResult -> msg) -> Sub msg

