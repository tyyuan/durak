import json

RANKS = {
  '6': 1,
  '7': 2,
  '8': 3,
  '9': 4,
  '10': 5,
  'J': 6,
  'Q': 7,
  'K': 8,
  'A': 9
}

RANK_NAMES = {
  1: '6',
  2: '7',
  3: '8',
  4: '9',
  5: '10',
  6: 'J',
  7: 'Q',
  8: 'K',
  9: 'A'
}

class Card:
  def __init__(self, rank, suit):
    self.rank = RANKS[rank]
    self.suit = suit

def ai_attack():
  pass

def parse_game(game_json):
  try:
    decoded = json.loads(game_json)
    return decoded
  except(ValueError, KeyError, TypeError):
    print('Game string is not valid JSON')
    return

def parse_card(card_string):
  if card_string == None:
    return None
  
  return Card(card_string[:-1], card_string[-1])

def get_valid_ranks(attacks):
  valid_ranks = {}
  
  for attack in attacks:
    valid_ranks[parse_card(attack['attacking']).rank] = None
    
    defending_card = parse_card(attack['defending'])
    if defending_card:
      valid_ranks[defending_card.rank] = None
  
  return valid_ranks

game = parse_game(open('test.json').read())
print get_valid_ranks(game['battlefield']['attacks'])