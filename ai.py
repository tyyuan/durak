import json
import math
import random
import sys
import time
import urlparse

from BaseHTTPServer import BaseHTTPRequestHandler
from copy import deepcopy

DEBUG = False

SURRENDER = None
NO_ATTACK = None

MCTS_TIME = 1.0
MAX_SIMULATED_MOVES = 1000

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

UCB = lambda w, n, t: float(w)/n + math.sqrt((2*math.log(t))/n)
score_node = UCB

def enum(**enums):
    return type('Enum', (object,), enums)

GameStates = enum(ATTACK = 1, DEFENSE = 2, DONE = 3)
PlayerStates = enum(ATTACKING = 1, DEFENDING = 2, SURRENDERED = 3, OUT = 4)

PARSE_PLAYER_STATUS = {
  'attacking': PlayerStates.ATTACKING,
  'defending': PlayerStates.DEFENDING,
  'surrendered': PlayerStates.SURRENDERED,
  'out': PlayerStates.OUT,
  None: None
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
    if other == None:
      return False
    
    return self.rank == other.rank and self.suit == other.suit
  
  def __ne__(self, other):
    return not self.__eq__(other)
  
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

class Player:
  def __init__(self, map):
    self.hand = [parse_card(q) for q in map['hand']]
    self.status = PARSE_PLAYER_STATUS[map['status']]

  def remove_cards(self, move):
    for card in move:
      if card != None:
        self.hand.remove(card)

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
      self.valid_ranks = {}
    
    if len(self.attacks) >= self.max_attacks:
      return

    self.valid_ranks[attack.rank] = None
    self.attacks.append(Attack({'attacking':attack.__str__(), 'defending': None}))

  def add_defense(self, index, block):
    self.valid_ranks[block.rank] = None

    self.attacks[index].defending_card = block
  
  def clear_battlefield(self):
    cards = []
    
    for attack in self.attacks:
      cards.append(attack.attacking_card)
      
      if attack.defending_card != None:
        cards.append(attack.defending_card)
    
    self.attacks = []
    self.valid_ranks = ALL_RANKS
    return cards
  
  def __str__(self):
    return str(self.__dict__)
  
  def __repr__(self):
    return self.__str__()

class Game:
  def __init__(self, map):
    self.attacking_player = map['attackingPlayer']
    self.defending_player = map['defendingPlayer']
    self.last_attacker = map['lastAttacker']
    self.deck = [parse_card(q) for q in map['deck']]
    self.battlefield = Battlefield(map['battlefield'])
    self.players = [Player(q) for q in map['players']]
    self.players_remaining = map['playersRemaining']
    self.attacks_remaining = self.players_remaining - 1
    self.state = None
    self.perspective = None
    
    global trump_suit
    trump_suit = parse_card(map['trumpCard']).suit
  
  def increment_player(self, n):
    if self.players_remaining <= 1:
      return n
    
    n = (n + 1) % len(self.players)
    
    while self.players[n].status == PlayerStates.OUT:
      n = (n + 1) % len(self.players)
    
    return n
  
  def next_attacker(self, n = None):
    if n == None:
      n = self.attacking_player
    
    n = self.increment_player(n)
    
    while n == self.defending_player:
      n = self.increment_player(n)
    
    return n
  
  def play_attack(self, move):
    if len(self.players[self.attacking_player].hand) == 0:
      self.next_phase()
      return
    
    if move == NO_ATTACK:
      self.attacks_remaining -= 1
    else:
      self.players[self.attacking_player].remove_cards(move)
      for card in move:
        self.battlefield.add_attack(card)
      self.attacks_remaining = self.players_remaining - 1
      self.last_attacker = self.attacking_player
    
    self.next_phase()
    
  def play_defense(self, move):
    if len(self.players[self.defending_player].hand) == 0:
      self.next_phase()
      return
    
    if move == SURRENDER:
      self.players[self.defending_player].status = PlayerStates.SURRENDERED
    else:
      self.players[self.defending_player].remove_cards(move)
      for i in range(len(move)):
        if move[i] != None:
          self.battlefield.add_defense(i, move[i])
    
    self.next_phase()
  
  def next_phase(self):
    if len(self.deck) == 0:
      for player in self.players:
        if len(player.hand) == 0:
          player.status = PlayerStates.OUT
          self.players_remaining -= 1

    if self.players_remaining <= 1:
      self.state = GameStates.DONE
      return
    
    if self.state == GameStates.ATTACK:
      if self.attacks_remaining == 0:
        self.end_round()
        return  
      elif self.last_attacker == self.attacking_player:
        if self.players[self.defending_player].status == PlayerStates.SURRENDERED:
          if len(self.battlefield.attacks) >= self.battlefield.max_attacks:
            self.end_round()
            return
          else:
            self.attacking_player = self.next_attacker()
            return
        else:
          self.state = GameStates.DEFENSE
          return
      else:
        self.attacking_player = self.next_attacker()
        return
    elif self.state == GameStates.DEFENSE:
      if len(self.battlefield.attacks) >= self.battlefield.max_attacks:
        self.end_round()
        return
      elif self.players[self.defending_player].status == PlayerStates.OUT:
        self.end_round()
        return
      else:
        self.state = GameStates.ATTACK
        
        if (self.players[self.attacking_player].status == PlayerStates.OUT):
          self.attacking_player = self.next_attacker()
        
        return
    else:
      raise ValueError('Game is not in a proper state.')
      
  
  def end_round(self):    
    if self.players_remaining <= 1:
      self.state = GameStates.DONE
      return

    if self.players[self.defending_player].status == PlayerStates.SURRENDERED:
      self.players[self.defending_player].hand += self.battlefield.clear_battlefield()
      self.attacking_player = self.next_attacker(self.defending_player)
    else:
      self.battlefield.clear_battlefield()
      if (self.players[self.defending_player].status == PlayerStates.OUT):
        self.attacking_player = self.next_attacker(self.defending_player)
      else:
        self.attacking_player = self.defending_player
    
    self.defending_player = self.increment_player(self.attacking_player)
    self.state = GameStates.ATTACK
    
    if len(self.deck) == 0:
      return
    
    current_player = self.last_attacker
    while len(self.players[current_player].hand) < 6:
      self.players[current_player].hand.append(self.deck.pop(0))
      
      if len(self.deck) == 0:
        return
    
    current_player = self.increment_player(current_player)
    while current_player != self.last_attacker:
      while len(self.players[current_player].hand) < 6:
        self.players[current_player].hand.append(self.deck.pop(0))
      
        if len(self.deck) == 0:
          return
      current_player = self.increment_player(current_player)
    
  def play_out(self):
    if self.state == GameStates.DONE:
      return self.players[self.perspective].status == PlayerStates.OUT
    
    random_game = deepcopy(self)
    moves = 0
    
    while random_game.state != GameStates.DONE:
      if random_game.state == GameStates.ATTACK:
        random_game.play_attack(random_attack(random_game))
      elif random_game.state == GameStates.DEFENSE:
        random_game.play_defense(random_defense(random_game))
        
      moves += 1

      if moves > MAX_SIMULATED_MOVES:
        return False
    
    return random_game.players[self.perspective].status == PlayerStates.OUT
  
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
  
  blocks_completed = 0
  for attack in game.battlefield.attacks:
    if attack.defending_card != None:
      blocks_completed += 1
  
  generate_defense_play(valid_blocks, defenses, blocks_completed, [None for i in range(blocks_completed)])
  
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

def random_attack(game):
  valid_attacks = get_valid_attack_moves(game)
  
  return random.choice(valid_attacks)

def random_defense(game):
  valid_defenses = get_valid_defense_moves(game)

  return random.choice(valid_defenses)

class Node:
  def __init__(self, game, parent):
    self.game = game
    self.move = None
    self.parent = parent
    self.children = None
    self.plays = 0
    self.wins = 0
    self.is_leaf = game.state == GameStates.DONE
    
  def update_statistics(self, additional_wins, additional_plays):
    current = self
    
    while current != None:
      current.plays += additional_plays
      current.wins += additional_wins
      current = current.parent
  
  def expand(self):
    if self.is_leaf:
      self.update_statistics(1 if self.game.play_out() else 0, 1)
      return
    
    self.children = []
    if self.game.state == GameStates.ATTACK:
      valid_moves = get_valid_attack_moves(self.game)

      for move in valid_moves:
        next_game = deepcopy(self.game)
        next_game.play_attack(move)
        child = Node(next_game, self)
        child.move = move
        self.children.append(child)
        child.update_statistics(1 if child.game.play_out() else 0, 1)
      
    elif self.game.state == GameStates.DEFENSE:
      valid_moves = get_valid_defense_moves(self.game)
      
      for move in valid_moves:
        next_game = deepcopy(self.game)
        next_game.play_defense(move)
        child = Node(next_game, self)
        child.move = move
        self.children.append(child)
        child.update_statistics(1 if child.game.play_out() else 0, 1)
        
  def __str__(self):
    return str(self.__dict__)
    
  def __repr__(self):
    return self.__str__()
      
def MCTS(root):
  root.expand()
  
  start_time = time.time()
  total_simulations = 1
  
  while True:
    current_node = root
    
    while current_node.children != None:      
      max_score = -999.99
      max_children = None
      for child in current_node.children:
        if child.is_leaf:
          continue
        
        score = score_node(child.wins, child.plays, total_simulations)
        
        if score > max_score:
          max_score = score
          max_child = child
      
      if max_child == None:
        current_node = random.choice(current_node.children)
        break
        
      current_node = max_child
    
    current_node.expand()
    
    total_simulations += 1
    if total_simulations % 20 == 0:
      if time.time() - start_time > MCTS_TIME:
        break
  
  best_moves = None
  max_plays = -1
  
  for child in root.children:
    if child.plays > max_plays:
      best_moves = [child.move]
      max_plays = child.plays
    elif child.plays == max_plays:
      best_moves.append(child.move)
  
  if best_moves == None:
    return random.choice(root.children).move
  
  return random.choice(best_moves)

def ai_attack(game):
  if len(get_valid_attack_moves(game)) == 1:
    return get_valid_attack_moves(game)[0]
  
  game.state = GameStates.ATTACK
  game.perspective = game.attacking_player
  
  root = Node(game, None)
  return MCTS(root)

def ai_defense(game):
  if len(get_valid_defense_moves(game)) == 1:
    return get_valid_defense_moves(game)[0]
  
  game.state = GameStates.DEFENSE
  game.perspective = game.defending_player
  
  root = Node(game, None)
  return MCTS(root)
  
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

        self.send_response(200)
        self.end_headers()
        self.wfile.write(message)
        return

    def end_headers (self):
        self.send_header('Access-Control-Allow-Origin', '*')
        BaseHTTPRequestHandler.end_headers(self)

if __name__ == '__main__':
    if len(sys.argv) == 3:
      DEBUG = True
      
      game = parse_game(open(sys.argv[2]).read())
      
      if(sys.argv[1] == 'a'):
        print 'ATTACK STRATEGY:',ai_attack(game)
      else:
        print 'DEFENSE STRATEGY:',ai_defense(game)
      
      sys.exit(0)
      
    from BaseHTTPServer import HTTPServer
    server = HTTPServer(('localhost', 8080), AIHandler)
    print 'Starting server. Use <Ctrl-C> to stop'
    server.serve_forever()
