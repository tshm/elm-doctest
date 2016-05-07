module Main where

import DocTest
import Signal

-- internal data stream
type alias Model =
  { specs : List DocTest.Spec
  , source : String
  }

model : Signal Model
model =
  Signal.map (\s -> { specs = DocTest.collectSpecs s, source = s }) srccode

-- input ports
port srccode : Signal String
port result : Signal { stdout: String, filename: String }

-- output ports
port evaluate : Signal { src: String, runner: String }
port evaluate = 
  let
    createEvaluationResource model =
      let
        src' = DocTest.createTempModule (model.source) (model.specs)
        runner = DocTest.evaluationScript
      in { src = src', runner = runner }
  in Signal.map createEvaluationResource model

port report : Signal { text: String, failed: Bool }
port report = Signal.map2 createReport model result

createReport : Model
  -> { stdout: String, filename: String }
  -> { text: String, failed: Bool }
createReport { specs } result
  = let
      text = DocTest.createReportFromResult result.filename specs result.stdout
    in { text = text, failed = True }

