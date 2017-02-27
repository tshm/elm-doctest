-- Read more about this program in the official Elm guide:
-- https://guide.elm-lang.org/architecture/effects/random.html
import Random

-- |
-- >>> 4 + 5
-- 9
--


-- MODEL
type alias Model =
  { dieFace : Int
  }


init : (Model, Cmd Msg)
init =
  (Model 1, Cmd.none)

-- UPDATE
type Msg
  = Roll
  | NewFace Int


update : Msg -> Model -> (Model, Cmd Msg)
update msg model =
  case msg of
    Roll ->
      (model, Random.generate NewFace (Random.int 1 6))

    NewFace newFace ->
      (Model newFace, Cmd.none)

-- SUBSCRIPTIONS
subscriptions : Model -> Sub Msg
subscriptions model =
  Sub.none

