import json

def choose_attack():
  pass

def parse_game(game_json):
  try:
    decoded = json.loads(game_json)
    return decoded
  except(ValueError, KeyError, TypeError):
    print('Game string is not valid JSON')
    return

parse_game(open('test.json').read())
