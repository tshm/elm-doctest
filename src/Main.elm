module Main where

import DocTest
import Signal
import String exposing (isEmpty)

-- data models
type alias Result = { stdout : String , filename : String }

-- input ports
port srccode : Signal String
port result : Signal Result

specs : Signal (List DocTest.Spec)
specs = srccode |> Signal.map DocTest.collectSpecs

-- output ports
port evaluate : Signal { src: String, runner: String }
port evaluate = 
  let createEvaluationResource specs src =
    { src = DocTest.createTempModule src specs
    , runner = DocTest.evaluationScript
    }
  in Signal.map2 createEvaluationResource specs srccode

port report : Signal DocTest.Report
port report = 
  let createReport specs { filename, stdout } =
    if List.isEmpty specs || isEmpty stdout
    then DocTest.Report "" False
    else DocTest.createReportFromOutput filename specs stdout
  in Signal.map2 createReport specs result

