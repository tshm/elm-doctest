port module Main exposing (..)

import DocTest
-- import String exposing (isEmpty)
import Html.App
import Html exposing (div)

main : Program Never
main =
  Html.App.program
    { init = init
    , update = update
    , subscriptions = subscriptions
    , view = view
    }

init : (Model, Cmd msg)
init =
  let
    model = { stdout = "", filename = "" }
  in (model, Cmd.none)

view : Model -> Html.Html Msg
view _ = div [] []

type Msg
  = InputSourceCode String
  | NewResult TestResult

update : Msg -> Model -> (Model, Cmd Msg)
update msg model =
  case msg of
    InputSourceCode source ->
      let 
        specs = DocTest.collectSpecs <| Debug.log "source" source
        out =
          { src = DocTest.createTempModule source specs
          , runner = DocTest.evaluationScript
          }
      in (model, evaluate out)

    NewResult rslt -> (model, Cmd.none)


-- data models
type alias TestResult = { stdout : String , filename : String }
type alias Model = TestResult

{--
  data flow
  1. @js: read elm source code
  2. @js: send it to the srccode port
  3. @elm: receive InputSourceCode message with sourcecode
  4. @elm: extract specs and create eval script
  5. @elm: send eval script back to js via evaluate port
  6. @js: 
--}
-- input ports
port srccode : (String -> msg) -> Sub msg
port result : (TestResult -> msg) -> Sub msg

subscriptions : Model -> Sub Msg
subscriptions _ =
  srccode InputSourceCode
  -- Sub.batch
  --   [ srccode InputSourceCode
  --   , result NewResult
  --   ]

-- output ports
port evaluate : { src: String, runner: String } -> Cmd msg

port report : DocTest.Report -> Cmd msg
{--
port report = 
  let createReport specs { filename, stdout } =
    if List.isEmpty specs || isEmpty stdout
    then DocTest.Report "" False
    else DocTest.createReportFromOutput filename specs stdout
  in Signal.map2 createReport specs result
--}

