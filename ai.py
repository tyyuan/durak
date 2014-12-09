import json
import random
import urlparse

from BaseHTTPServer import BaseHTTPRequestHandler
from copy import deepcopy

SURRENDER = None
NO_ATTACK = None

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

SUITS = {
  'C': 'Clubs',
  'D': 'Diamonds',
  'S': 'Spades',
  'H': 'Hearts'
}

ALL_RANKS = {
  1: None,
  2: None,
  3: None,
  4: None,
  5: None,
  6: None,
  7: None,
  8: None,
  9: None
}

trump_suit = None

class Card:
  def __init__(self, rank, suit):
    self.rank = RANKS[rank]
    self.suit = suit
  
  def trump(self):
    return self.suit == trump_suit
  
  def __str__(self):
    return RANK_NAMES[self.rank] + self.suit
  
  def __repr__(self):
    return self.__str__()
    
  def __eq__(self, other):
    return self.rank == other.rank and self.suit == other.suit
  
  def __ne__(self, other):
    return not self.eq(other)
  
  def __gt__(self, other):
    if self.trump() and not other.trump():
      return True
    elif other.trump() and not self.trump():
      return False
    elif self.suit == other.suit:
      return self.rank > other.rank
    else:
      return False
  
  def __lt__(self, other):
    if (self.suit == other.suit or self.trump() != other.trump()):
      return not self.__gt__(other)
    else:
      return False

def parse_card(card_string):
  if card_string == None:
    return None

  return Card(card_string[:-1], card_string[-1])

ALL_CARDS = [Card(rank, suit) for rank in RANKS.keys() for suit in SUITS.keys()]

class Player:
  def __init__(self, map):
    self.hand = [parse_card(q) for q in map['hand']]
    self.status = map['status']

  def __str__(self):
    return str(self.__dict__)
  
  def __repr__(self):
    return self.__str__()

class Attack:
  def __init__(self, map):
    self.attacking_card = parse_card(map['attacking'])
    self.defending_card = parse_card(map['defending'])
  
  def __str__(self):
    return str(self.__dict__)
  
  def __repr__(self):
    return self.__str__()

class Battlefield:
  def __init__(self, map):
    self.max_attacks = map['maxAttacks']
    self.attacks = [Attack(q) for q in map['attacks']]
    self.valid_ranks = self.get_valid_ranks()
  
  def get_valid_ranks(self):
    if len(self.attacks) == 0:
      return ALL_RANKS
    
    valid_ranks = {}
  
    for attack in self.attacks:
      valid_ranks[attack.attacking_card.rank] = None
    
      defending_card = attack.defending_card
      if defending_card:
        valid_ranks[defending_card.rank] = None
  
    return valid_ranks

  def add_attack(self, attack):
    if len(self.attacks) == 0:
      valid_ranks = {}

    valid_ranks[attack.rank] = None
    self.attacks.append(Attack({'attacking':attack.__str__(), 'defending': None}))

  def add_block(self, index, block):
    valid_ranks[block.rank] = None

    self.attacks[index].defending_card = block
    
  def __str__(self):
    return str(self.__dict__)
  
  def __repr__(self):
    return self.__str__()

class Game:
  def __init__(self, map):
    self.attacking_player = map['attackingPlayer']
    self.defending_player = map['defendingPlayer']
    self.deck = [parse_card(q) for q in map['deck']]
    self.battlefield = Battlefield(map['battlefield'])
    self.players = [Player(q) for q in map['players']]
    self.players_remaining = map['playersRemaining']
    self.trump_card = parse_card(map['trumpCard'])
    
    global trump_suit
    trump_suit = self.trump_card.suit
  
  def __str__(self):
    return str(self.__dict__)
  
  def __repr__(self):
    return self.__str__()

class DurakJSONEncoder(json.JSONEncoder):
  def default(self, obj):
    if isinstance(obj, Card):
      return obj.__str__()

    return json.JSONEncoder.default(self, obj)

def get_valid_attack_moves(game):
  valid_attacks = []
  
  if len(game.battlefield.attacks) > 0:
    valid_attacks.append(NO_ATTACK)

  for rank in game.battlefield.valid_ranks.keys():
    cards_of_rank = []

    for card in game.players[game.attacking_player].hand:
      if card.rank == rank:
        cards_of_rank.append(card)

    if (len(cards_of_rank) == 0):
      continue

    generate_attack_play(valid_attacks, cards_of_rank, 0, [], game.battlefield.max_attacks - len(game.battlefield.attacks))

  return valid_attacks

def generate_attack_play(valid_attacks, cards_of_rank, index, cards_played, max_attacks):
  if index >= len(cards_of_rank):
    valid_attacks.append(cards_played)
    return

  if len(cards_played) > max_attacks:
    return
  
  updated_cards_played = deepcopy(cards_played)
  updated_cards_played.append(cards_of_rank[index])

  generate_attack_play(valid_attacks, cards_of_rank, index+1, updated_cards_played, max_attacks)

  if (index > 0):
    generate_attack_play(valid_attacks, cards_of_rank, index+1, cards_played, max_attacks)

def get_valid_blocks(game):
  blocks = [None for i in game.battlefield.attacks]
  
  for i in range(len(game.battlefield.attacks)):
    attack = game.battlefield.attacks[i]
    blocks_for_slot = []
    
    if not attack.defending_card:
      for card in game.players[game.defending_player].hand:
        if card > attack.attacking_card:
          blocks_for_slot.append(card)
    
    blocks[i] = blocks_for_slot
  
  return blocks
  
def get_valid_defense_moves(game):
  valid_blocks = get_valid_blocks(game)
  
  defenses = [SURRENDER]
  
  generate_defense_play(valid_blocks, defenses, 0, [])
  
  return defenses

def generate_defense_play(valid_blocks, defenses, blocks_completed, current_plays):
  if blocks_completed >= len(valid_blocks):
    defenses.append(current_plays)
    return
  
  if len(valid_blocks[blocks_completed]) == 0:
    return
  
  for block in valid_blocks[blocks_completed]:
    updated_valid_blocks = deepcopy(valid_blocks)
    updated_plays = deepcopy(current_plays)
    
    updated_plays.append(block)
    for i in range(blocks_completed + 1, len(updated_valid_blocks)):
      if block in updated_valid_blocks[i]:
       updated_valid_blocks[i].remove(block)
    
    generate_defense_play(updated_valid_blocks, defenses, blocks_completed + 1, updated_plays)

def ai_attack(game):
  valid_attacks = get_valid_attack_moves(game)

  return random.choice(valid_attacks)

def ai_defense(game):
  valid_defenses = get_valid_defense_moves(game)

  return random.choice(valid_defenses)

def parse_game(game_json):
  try:
    decoded = json.loads(game_json)
        
    return Game(decoded)
  except(ValueError, KeyError, TypeError):
    print('Game string is not valid JSON')
    return

class AIHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        parsed_path = urlparse.urlparse(self.path)
        length = int(self.headers['Content-Length'])
        post_data = self.rfile.read(length).decode('utf-8')

        game = parse_game(post_data)

        message = ''

        if (parsed_path.path == '/attack'):
          message = json.dumps(ai_attack(game), cls=DurakJSONEncoder)
        elif (parsed_path.path == '/defense'):
          message = json.dumps(ai_defense(game), cls=DurakJSONEncoder)
        else:
          message = 'Invalid path.'

        print ('Sending headers...')
        self.send_response(200)
        self.end_headers()
        self.wfile.write(message)
        return

    def end_headers (self):
        self.send_header('Access-Control-Allow-Origin', '*')
        BaseHTTPRequestHandler.end_headers(self)

if __name__ == '__main__':
    from BaseHTTPServer import HTTPServer
    server = HTTPServer(('localhost', 8080), AIHandler)
    print 'Starting server. Use <Ctrl-C> to stop'
    server.serve_forever()
