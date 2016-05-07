module Main where

import DocTest
import Signal
import String exposing (isEmpty)
-- import Array exposing (Array)
-- import Debug exposing (..)

specs : Signal (List DocTest.Spec)
specs = Signal.map DocTest.collectSpecs srccode

-- input ports
port srccode : Signal String
port result : Signal Result
-- , { result: [], srccode: '' }

--type alias Result = String
type alias Result =
  { stdout : String
  , filename : String
  }
--type alias N = Int
--{evals: String, filename: String}
  -- { evals: List
  --   { result: Bool
  --   , output: String
  --   }
  -- , filename: String
  -- }

-- output ports
port evaluate : Signal { src: String, runner: String }
port evaluate = 
  let
    createEvaluationResource specs src =
      { src = DocTest.createTempModule src specs
      , runner = DocTest.evaluationScript
      }
  in Signal.map2 createEvaluationResource specs srccode

port report : Signal { text: String, failed: Bool }
port report = Signal.map2 createReport specs result

createReport : List (DocTest.Spec) -> Result -> { text: String, failed: Bool }
createReport specs result
  = let
      (text, succeed) =
        if List.length specs > 0 && not (isEmpty result.stdout)
        then DocTest.createReportFromResult result.filename specs result.stdout
        else ("", True)
    in { text = text, failed = not succeed }

