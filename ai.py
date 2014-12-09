import json
import random

from copy import deepcopy

SURRENDER = 'SURRENDER'

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
    
  def __str__(self):
    return str(self.__dict__)
  
  def __repr__(self):
    return self.__str__()

class Game:
  def __init__(self, map):
    self.attacking_ai = map['attackingAI']
    self.attacking_player = map['attackingPlayer']
    self.defending_player = map['defendingPlayer']
    self.deck_size = map['deckSize']
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

def get_valid_attacks(game):
  return [q for q in game.players[game.attacking_player].hand if q.rank in game.battlefield.valid_ranks]

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
  
def get_valid_defenses(game):
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
  valid_attacks = get_valid_attacks(game)

def parse_game(game_json):
  try:
    decoded = json.loads(game_json)
        
    return Game(decoded)
  except(ValueError, KeyError, TypeError):
    print('Game string is not valid JSON')
    return

game = parse_game(open('test5.json').read())
print get_valid_blocks(game)
print get_valid_defenses(game)