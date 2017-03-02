port module Main exposing (..)

import DocTest
import String

main : Program Never Model Msg
main =
  Platform.program
    { init = (emptyModel, Cmd.none)
    , update = update
    , subscriptions = subscriptions
    }

type Msg
  = AddFileQueue (List String)
  | Input SourceCode
  | NewResult TestResult
  | GoNext Bool

update : Msg -> Model -> (Model, Cmd Msg)
update msg model =
  case msg of
    AddFileQueue filenames ->
      { model | fileQueue = model.fileQueue ++ filenames } ! [ Cmd.none ]

    Input { code, filename } ->
      let
        (testcode, specs) = DocTest.collectSpecs code
        out =
          { src = DocTest.createTempModule testcode specs
          , runner = DocTest.evaluationScript specs
          , filename = filename
          }
      in ({ model | currentSpecs = specs }, evaluate out)

    NewResult result ->
      let
        createReport specs { filename, stdout, failed } =
          if failed then DocTest.Report stdout True
          else if List.isEmpty specs    then DocTest.Report "no test found" False
          else if String.isEmpty stdout then DocTest.Report "" False
          else DocTest.createReportFromOutput filename specs stdout
        reportData = createReport model.currentSpecs result
        success = model.success && (not reportData.failed)
      in { model | success = success } ! [ report reportData ]

    GoNext watch ->
      case model.fileQueue of
        newfile :: rest -> { model | fileQueue = rest } ! [ readfile newfile ]
        [] ->
          if watch || model.success then (model, Cmd.none)
          else (model, exit ())

-- output ports
port readfile : String -> Cmd msg
port evaluate : { src: String, runner: String, filename: String } -> Cmd msg
port report : DocTest.Report -> Cmd msg
port exit : () -> Cmd msg

-- data models
type alias SourceCode = { code : String , filename : String }
type alias TestResult = { stdout : String , filename : String, failed : Bool }
type alias Model =
  { currentSpecs : List DocTest.Spec
  , fileQueue : List String
  , success : Bool
  }

emptyModel : Model
emptyModel =
  { currentSpecs = []
  , fileQueue = []
  , success = True
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
    [ addfiles AddFileQueue
    , srccode Input
    , result NewResult
    , next GoNext
    ]

-- input ports
port addfiles : ((List String) -> msg) -> Sub msg
port srccode : (SourceCode -> msg) -> Sub msg
port result : (TestResult -> msg) -> Sub msg
port next : (Bool -> msg) -> Sub msg
