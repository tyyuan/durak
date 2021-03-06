goog.provide('durak.game');
goog.provide('durak.game.Game');
goog.provide('durak.game.Card');
goog.provide('durak.game.Deck');
goog.provide('durak.game.Player');
goog.provide('durak.game.Battlefield');

goog.require('goog.dom');
goog.require('goog.dom.classes');
goog.require('goog.events');
goog.require('goog.json.Serializer');
goog.require('goog.net.XhrIo');

durak.game.Suits = {
    CLUBS: 'C',
    HEARTS: 'H',
    SPADES: 'S',
    DIAMONDS: 'D'
};

durak.game.Ranks = {
    SIX: 1,
    SEVEN: 2,
    EIGHT: 3,
    NINE: 4,
    TEN: 5,
    JACK: 6,
    QUEEN: 7,
    KING: 8,
    ACE: 9
};

durak.game.RankNames = {
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

durak.game.ParseRanks = {
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

durak.game.Card = function(suit, rank) {
    this.suit = suit;
    this.rank = rank;
    this.imageElement = goog.dom.createDom('img',
            {'class': 'card',
             'src': this.getImageName()});
};

durak.game.Card.prototype.getImageName = function() {
    return 'img/' + this.getString() + '.png';
};

durak.game.Card.prototype.canBeat = function(other) {
    if (this.suit == game.trumpSuit && other.suit != game.trumpSuit) {
        return true;
    } else if (other.suit == game.trumpSuit && this.suit != game.trumpSuit) {
        return false;
    } else if (this.suit != other.suit) {
        return false
    }

    return this.rank > other.rank;
}

durak.game.Card.prototype.equals = function(other) {
    return this.suit == other.suit && this.rank == other.rank;
}

durak.game.Card.prototype.getString = function() {
    return durak.game.RankNames[this.rank] + this.suit
};

durak.game.Deck = function() {
    this.deck = [];
    for (var suit in durak.game.Suits) {
        for (var rank in durak.game.Ranks) {
            this.deck.push(new durak.game.Card(
                durak.game.Suits[suit], durak.game.Ranks[rank]));
        }
    }
    this.deckElement = document.getElementById('deck_image');
    this.trumpElement = document.getElementById('trump');
};

durak.game.Deck.prototype.shuffle = function() {
    for (var i = 0; i < this.deck.length; i++) {
        var temp = this.deck[i];
        var swap = Math.floor(Math.random() * this.deck.length);
        this.deck[i] = this.deck[swap];
        this.deck[swap] = temp;
    }
}

durak.game.Deck.prototype.draw = function() {
    if (this.deck.length <= 0) {
        return null;
    }

    var card = this.deck.shift();

    if (this.deck.length == 1) {
        this.deckElement.style.visibility = 'hidden';
    }
    if (this.deck.length == 0) {
        this.trumpElement.style.visibility = 'hidden';
    }

    return card;
}

durak.game.Deck.prototype.getTrump = function() {
    return this.deck[this.deck.length - 1];
};

durak.game.Deck.prototype.export = function() {
    return this.deck.map(function (element) {
            return element.getString();
    });
}

durak.game.Player = function(name, human) {
    this.hand = []
    this.name = name;
    this.human = human;
    this.active = true;
    this.contentElement = document.getElementById(this.name);
    this.statusElement = document.querySelector('#' + this.name + ' .status');
    this.playedAttack = false;
};

durak.game.Player.prototype.init = function() {
    this.active = true;
    this.hand = []
    this.removeStatus();

    if (this.human) {
        this.handList = document.getElementById('hand');
        goog.dom.removeChildren(this.handList);
        this.selectedCard = null;
        this.selectedIndex = -1;
    } else {
        this.countElement = document.querySelector('#' + this.name + ' .opponent_hand .card_count');
    }
}

durak.game.Player.prototype.addCard = function(card) {
    this.hand.push(card);

    if (this.human) {
        goog.dom.appendChild(this.handList, card.imageElement);
        goog.events.listen(card.imageElement, goog.events.EventType.CLICK, this.selectCard, false, this);
    } else {
        this.countElement.innerHTML = this.hand.length;
    }
};

durak.game.Player.prototype.addCards = function(cards) {
    for (var i = 0; i < cards.length; i++) {
        this.addCard(cards[i]);
    }
    
    if (this.human) {
      this.deselectCards();
    }
};

durak.game.Player.prototype.removeCard = function(index) {
    var card= this.hand[index]
    this.hand.splice(index, 1);
    if (this.human) {
        goog.dom.removeNode(card.imageElement);
        this.deselectCards();
    } else {
        this.countElement.innerHTML = this.hand.length;
    }

    return card;
}

durak.game.Player.prototype.selectCard = function(e) {
    if (game.state != GameStates.PLAYER_ATTACK && game.state != GameStates.PLAYER_DEFEND) {
        return;
    }

    for(var i = 0; i < this.hand.length; i++) {
        if (this.hand[i].imageElement == e.target) {
            goog.dom.classes.add(this.hand[i].imageElement, 'selected');
            this.selectedCard = this.hand[i];
            this.selectedIndex = i;
        } else {
            goog.dom.classes.remove(this.hand[i].imageElement, 'selected');
        }
    }
}

durak.game.Player.prototype.deselectCards = function() {
    if (this.selectedCard != null) {
        for(var i = 0; i < this.hand.length; i++) {
            goog.dom.classes.remove(this.hand[i].imageElement, 'selected');
        }
    }

    this.selectedCard = null;
    this.selectedIndex = -1;
}

durak.game.Player.prototype.setStatus = function(status) {
    this.removeStatus();

    this.status = status;
    this.statusElement.innerHTML = status;
    goog.dom.classes.add(this.contentElement, status);
}

durak.game.Player.prototype.removeStatus = function() {
    if (this.status != null) {
        goog.dom.classes.remove(this.contentElement, this.status);
    }
    this.status = null;
    this.statusElement.innerHTML = '';
}

durak.game.Player.prototype.checkIfOut = function() {
    if (this.hand.length <= 0) {
        this.removeFromGame();
    }
}

durak.game.Player.prototype.removeFromGame = function() {
    this.setStatus('out');
    this.active = false;
    this.playedAttack = false;
    game.playersRemaining -= 1;
    game.checkForGameOver();
}

durak.game.Player.prototype.export = function() {
    return {
        'hand': this.hand.map(function (element) {
            return element.getString();
        }),
        'status': this.status
    };
}

durak.game.Attack = function(attackingCard) {
    this.attackingCard = attackingCard;
    this.defendingCard = null;
    this.divElement = goog.dom.createDom('div', {'class': 'attack'}, attackingCard.imageElement);
}

durak.game.Attack.prototype.defend = function(card) {
    this.defendingCard = card;
    goog.dom.classes.add(this.defendingCard.imageElement, 'defending_card');
    goog.dom.appendChild(this.divElement, card.imageElement);
}

durak.game.Attack.prototype.export = function() {
    return {
        'attacking': this.attackingCard.getString(),
        'defending': (this.defendingCard != null) ? this.defendingCard.getString() : null
    };
}

durak.game.Battlefield = function() {
    this.attacks = [];
    this.validRanks = new Set();
    this.maxAttacks = 0;
    this.contentElement = document.getElementById('battlefield');
    this.attackingSlot = goog.dom.createDom('div', {'id':'attacking_slot'});
    this.placeholder = goog.dom.createDom('span', {'id':'placeholder'}, '');
    goog.dom.appendChild(this.contentElement, this.placeholder);
    goog.events.listen(this.attackingSlot, goog.events.EventType.CLICK,
                       this.makePlayerAttack, false, this);
}

durak.game.Battlefield.prototype.addAttack = function(card) {
    if (!this.validRanks.has(card.rank) && this.validRanks.size != 0) {
        return;
    }
    if (this.attacks.length >= this.maxAttacks) {
        return;
    }

    var newAttack = new durak.game.Attack(card);

    if (game.players[game.defendingPlayer].human) {
        goog.events.listen(newAttack.divElement, goog.events.EventType.CLICK,
                    this.makePlayerDefense, false, this);
    }

    goog.dom.appendChild(this.contentElement, newAttack.divElement);
    this.attacks.push(newAttack);
    this.validRanks.add(card.rank);
}

durak.game.Battlefield.prototype.addDefense = function(card, index) {
    var attackingCard = this.attacks[index].attackingCard;

    if (!card.canBeat(attackingCard)) {
        return;
    }

    this.attacks[index].defend(card);
    this.validRanks.add(card.rank);
}

durak.game.Battlefield.prototype.hasNewAttacks = function() {
    for (var i = 0; i < this.attacks.length; i++) {
        if (this.attacks[i].defendingCard == null) {
            return true;
        }
    }
    return false;
}

durak.game.Battlefield.prototype.addAttackingSlot = function() {
    goog.dom.appendChild(this.contentElement, this.attackingSlot);
}

durak.game.Battlefield.prototype.removeAttackingSlot = function() {
    goog.dom.removeNode(this.attackingSlot);
}

durak.game.Battlefield.prototype.makePlayerAttack = function(){
    if (game.players[game.attackingPlayer].selectedCard == null) {
        return
    }

    var card = game.players[game.attackingPlayer].selectedCard;
    if (!this.validRanks.has(card.rank) && this.validRanks.size != 0) {
        updateStatusText('You must play a card that shares rank with a card already played.');
    } else {
        this.addAttack(game.players[game.attackingPlayer]
            .removeCard(game.players[game.attackingPlayer].selectedIndex));
        this.removeAttackingSlot();
        game.players[game.attackingPlayer].playedAttack = true;
        game.lastAttacker = game.attackingPlayer;

        if (this.attacks.length < this.maxAttacks) {
            this.addAttackingSlot();
            updateStatusText('Play an attack, or pass.');
        } else {
            updateStatusText('The maximum number of attacking cards has been played.');
        }

        if (game.deck.deck.length == 0) {
            game.players[game.attackingPlayer].checkIfOut();
        }

        waitForNext();
    }
    game.players[game.attackingPlayer].deselectCards();
}

durak.game.Battlefield.prototype.makePlayerDefense = function(e) {
    if (game.players[game.defendingPlayer].selectedCard == null ||
        game.state != GameStates.PLAYER_DEFEND) {
        return;
    }

    var card = game.players[game.defendingPlayer].selectedCard;

    for (var i = 0; i < this.attacks.length; i++) {
        if (e.target == this.attacks[i].attackingCard.imageElement) {
            if (this.attacks[i].defendingCard != null) {
                updateStatusText('You have already beaten that card.');
                break;
            }
            var attackingCard = this.attacks[i].attackingCard;
            if (card.canBeat(attackingCard)) {
                game.players[game.defendingPlayer]
                    .removeCard(game.players[game.defendingPlayer].selectedIndex);
                this.addDefense(card, i);
                
                for (var i = 0; i < game.players.length; i++) {
                    if (game.players[i].active) {
                        game.players[i].playedAttack = true;
                    }
                }

                if (!this.hasNewAttacks()) {
                    updateStatusText('You have beaten all current attacks.');
                    if (game.deck.deck.length == 0) {
                        game.players[game.defendingPlayer].checkIfOut();
                    }
                    game.state = GameStates.AFTER_DEFENSE;
                    waitForNext();
                }
            } else {
                updateStatusText('You must play a higher card of the same suit or a trump card.');
            }

            break;
        }
    }
    game.players[game.defendingPlayer].deselectCards();

}

durak.game.Battlefield.prototype.clearBattlefield = function() {
    var allCards = []
    for (var i = 0; i < this.attacks.length; i++) {
        allCards.push(this.attacks[i].attackingCard);
        if (this.attacks[i].defendingCard !== null) {
            goog.dom.classes.remove(this.attacks[i].defendingCard.imageElement, 'defending_card');
            allCards.push(this.attacks[i].defendingCard);
        }
    }

    this.attacks = [];
    this.validRanks = new Set();
    goog.dom.removeChildren(this.contentElement);
    goog.dom.appendChild(this.contentElement, this.placeholder);
    return allCards;
}

durak.game.Battlefield.prototype.export = function() {
    return {
        'attacks': this.attacks.map(function(element) {return element.export()}),
        'maxAttacks': this.maxAttacks
    };
}

var GameStates = {
    AFTER_AI_ATTACK: 0,
    AFTER_DEFENSE: 1,
    PLAYER_ATTACK: 2,
    END_OF_ROUND: 3,
    START_REDRAW: 4,
    REDRAWING: 5,
    PLAYER_DEFEND: 6,
    READY_TO_INITIATE: 7,
    GAME_OVER: 8,
    WAITING_FOR_ATTACK_RPC: 9,
    WAITING_FOR_DEFENSE_RPC: 10
};

durak.game.Game = function() {
    this.deck = new durak.game.Deck();
    this.battlefield = new durak.game.Battlefield();
    this.players = [
        new durak.game.Player('Player', true),
        new durak.game.Player('Olga', false),
        new durak.game.Player('Vladimir', false),
        new durak.game.Player('Ekaterina', false)
    ];
    this.state = GameStates.GAME_OVER;
    this.trumpSuit = null;
    this.trumpCard = null;
    this.attackingPlayer = 0;
    this.defendingPlayer = 0;
    this.lastAttacker = 0;
    this.currentDraw = 0;
    this.playersRemaining = 0;

    this.serializer = new goog.json.Serializer();
    this.xhr = new goog.net.XhrIo();

    goog.events.listen(this.xhr, goog.net.EventType.COMPLETE, this.processCallback,
                      false, this);

};

durak.game.Game.prototype.deal = function() {
    for (var j = 0; j < this.players.length; j++) {
        this.players[j].init();
    }
    this.playersRemaining = this.players.length;

    this.deck = new durak.game.Deck();
    this.battlefield = new durak.game.Battlefield();
    this.deck.shuffle();

    for (var i = 0; i < 6; i++) {
        for (var j = 0; j < this.players.length; j++) {
            this.players[j].addCard(this.deck.draw());
        }
    }

    this.trumpCard = this.deck.getTrump();
    this.trumpSuit = this.trumpCard.suit;
    this.deck.trumpElement.style.display = 'inline';
    this.deck.trumpElement.style.visibility = 'visible';
    this.deck.trumpElement.src = this.trumpCard.getImageName();
    this.deck.deckElement.style.visibility = 'visible';
    dealButton.style.display = 'none';

    var trumpLabel = document.getElementById('trump_symbol');
    var suitsSymbols = {
        'S': '♠',
        'H': '♥',
        'D': '♦',
        'C': '♣'};
    trumpLabel.innerHTML = suitsSymbols[this.trumpSuit];
    if (this.trumpSuit == 'H' || this.trumpSuit == 'D') {
        trumpLabel.style.color = '#E00';
    } else {
        trumpLabel.style.color = '#000';
    }

    this.attackingPlayer = this.findFirstPlayer();
    this.defendingPlayer = this.incrementPlayer(this.attackingPlayer);
    this.initiateRound();
};

durak.game.Game.prototype.initiateRound = function() {
    for (var i = 0; i < this.players.length; i++) {
        if (this.players[i].active) {
            this.players[i].removeStatus();
            this.players[i].playedAttack = true;
        }
    }

    this.lastAttacker = this.attackingPlayer;
    this.players[this.attackingPlayer].setStatus('attacking');
    this.players[this.defendingPlayer].setStatus('defending');

    this.battlefield.maxAttacks = Math.min(6, this.players[this.defendingPlayer].hand.length);

    this.attack();
}

durak.game.Game.prototype.findFirstPlayer = function() {
    var lowestTrump = null;
    var firstPlayer = Math.floor(Math.random() * this.playersRemaining);
    
    for (var i = 0; i < this.players.length; i++) {
        var playerLowestTrump = null;
        
        for (var j = 0; j < this.players[i].hand.length; j++) {
            if (this.players[i].hand[j].suit == game.trumpSuit) {
                if (playerLowestTrump == null) {
                    playerLowestTrump = this.players[i].hand[j];
                } else if (this.players[i].hand[j].rank < playerLowestTrump.rank) {
                    playerLowestTrump = this.players[i].hand[j]
                }
            }
        }
        
        if (playerLowestTrump != null) {
            if (lowestTrump == null) {
                lowestTrump = playerLowestTrump;
                firstPlayer = i;
            } else if (playerLowestTrump.rank < lowestTrump.rank) {
                lowestTrump = playerLowestTrump;
                firstPlayer = i;
            }
        }
    }
    
    return firstPlayer;
}

durak.game.Game.prototype.attack = function() {
    if (this.battlefield.attacks.length >= this.battlefield.maxAttacks) {
            this.state = GameStates.END_OF_ROUND;
            updateStatusText('Maximum number of cards have been played. End of round.');
            waitForNext();
            return;
    }

    if (this.players[this.attackingPlayer].human) {
        this.state = GameStates.PLAYER_ATTACK;
        this.players[this.attackingPlayer].playedAttack = false;

        if(game.battlefield.attacks.length > 0) {
            updateStatusText('Play an attack, or pass.');
            waitForNext();
        } else {
            updateStatusText('Play an attack.');
        }

        this.battlefield.addAttackingSlot();
    } else {
        this.state = GameStates.WAITING_FOR_ATTACK_RPC;
        this.sendRPC('attack');
    }
}

durak.game.Game.prototype.defend = function() {
    if (this.players[this.defendingPlayer].human) {
        this.state = GameStates.PLAYER_DEFEND;
        updateStatusText('Defend against the attack, or surrender.');

        surrenderButton.style.display = 'inline';
    } else {
        this.state = GameStates.WAITING_FOR_DEFENSE_RPC;
        this.sendRPC('defense');
    }
}

durak.game.Game.prototype.surrender = function() {
    updateStatusText(this.players[this.defendingPlayer].name + ' surrenders.');
    this.players[this.defendingPlayer].setStatus('surrendered');
}

durak.game.Game.prototype.playerSurrender = function() {
    updateStatusText('You surrender.');
    this.players[this.defendingPlayer].setStatus('surrendered');
    surrenderButton.style.display = 'none';
    this.state = GameStates.AFTER_DEFENSE;
    this.players[this.defendingPlayer].deselectCards();
    waitForNext();
}

durak.game.Game.prototype.nextAttacker = function() {
    if (this.players[this.attackingPlayer].active) {
        this.players[this.attackingPlayer].removeStatus();
    }

    this.attackingPlayer = this.incrementPlayer(this.attackingPlayer);

    while (this.attackingPlayer == this.defendingPlayer) {
        this.attackingPlayer = this.incrementPlayer(this.attackingPlayer);
    }

    this.players[this.attackingPlayer].setStatus('attacking');
}

durak.game.Game.prototype.incrementPlayer = function(p) {
    p += 1;
    if (p >= this.players.length) {
        p = 0;
    }

    while (!this.players[p].active) {
            p += 1;
            if (p >= this.players.length) {
                p = 0;
            }
    }

    return p;
}

durak.game.Game.prototype.endRound = function() {
    var clearedCards = this.battlefield.clearBattlefield()
    if (this.players[this.defendingPlayer].status == 'surrendered') {
        updateStatusText(this.players[this.defendingPlayer].name + ' takes ' + clearedCards.length + ' cards.');
        this.players[this.defendingPlayer].addCards(clearedCards);
        this.attackingPlayer = this.incrementPlayer(this.defendingPlayer);
    } else {
        updateStatusText(this.players[this.defendingPlayer].name + ' successfully defended.');
        this.attackingPlayer = this.defendingPlayer;
    }
    this.defendingPlayer = this.incrementPlayer(this.attackingPlayer);

    if (this.deck.deck.length > 0) {
        this.currentDraw = this.lastAttacker;
        this.state = GameStates.START_REDRAW;
        waitForNext();
    } else {
        this.state = GameStates.READY_TO_INITIATE;
        waitForNext();
    }
}

durak.game.Game.prototype.redraw = function() {
    if (this.deck.deck.length <= 0 ||
        (this.state == GameStates.REDRAWING && this.currentDraw == this.lastAttacker)) {
        this.initiateRound();
        return;
    }

    if (this.state = GameStates.START_REDRAW) {
        this.state = GameStates.REDRAWING;
    }

    var cardsDrawn = 0;

    while (this.players[this.currentDraw].hand.length < 6 && this.deck.deck.length > 0) {
        this.players[this.currentDraw].addCard(this.deck.draw());
        cardsDrawn += 1;
    }

    if (cardsDrawn > 0) {
        updateStatusText(this.players[this.currentDraw].name + ' draws ' + cardsDrawn + ' cards.');
        this.currentDraw = this.incrementPlayer(this.currentDraw);
        waitForNext();
    } else {
        this.currentDraw = this.incrementPlayer(this.currentDraw);
        this.redraw();
    }
}

durak.game.Game.prototype.checkForGameOver = function() {
    if (this.playersRemaining <= 1) {
        var loser = null;
        for (var i = 0; i < this.players.length; i++) {
            if (this.players[i].active) {
                loser = this.players[i].name;
            }
        }

        updateStatusText('This game is over! ' + loser + ' is the durak!');
        this.state = GameStates.GAME_OVER;
        surrenderButton.style.display = 'none';
        passButton.style.display = 'none';
    }
}

durak.game.Game.prototype.nextPhase = function() {
    passButton.style.display = 'none';
    
    if (this.state == GameStates.GAME_OVER) {
        return;
    }

    if (this.state == GameStates.READY_TO_INITIATE) {
        this.initiateRound();
        return;
    }
    if (this.state == GameStates.END_OF_ROUND) {
        this.endRound();
        return;
    }
    if (this.state == GameStates.START_REDRAW || this.state == GameStates.REDRAWING) {
        this.redraw();
        return;
    }

    if (!this.players[this.lastAttacker].active) {
        this.lastAttacker = this.incrementPlayer(this.lastAttacker);

        while (this.lastAttacker == this.defendingPlayer) {
            this.lastAttacker = this.incrementPlayer(this.lastAttacker);
        }
    }

    var noAttacks = true;
    for (var i = 0; i < this.players.length; i++) {
        if (i == this.defendingPlayer) {
            continue;
        }

        if (!this.players[i].active) {
            continue;
        }

        if (this.players[i].playedAttack) {
            noAttacks = false;
            break;
        }
    }

    if (noAttacks && this.attackingPlayer == this.lastAttacker) {
        this.state = GameStates.END_OF_ROUND;
        updateStatusText('No new attacks have been made. End of this round.');
        waitForNext();
        return;
    }

    if (this.state == GameStates.AFTER_AI_ATTACK || this.state == GameStates.PLAYER_ATTACK) {
        if(this.state == GameStates.PLAYER_ATTACK) {
            this.players[this.attackingPlayer].deselectCards();
            this.battlefield.removeAttackingSlot();
        }

        if (this.players[this.defendingPlayer].status == 'surrendered') {
            this.nextAttacker();
            this.attack();
        } else {
            if (this.battlefield.hasNewAttacks()) {
                this.defend();
            } else {
                this.nextAttacker();
                this.attack();
            }
        }
    } else if (this.state == GameStates.AFTER_DEFENSE) {
        surrenderButton.style.display = 'none';

        if (this.players[this.defendingPlayer].active) {
            if (this.players[this.attackingPlayer].active) {
              this.attack();
            } else {
              this.nextAttacker();
              this.attack();
            }
        } else {
            this.endRound();
        }
    }
}

durak.game.Game.prototype.export = function() {
    return {
        'battlefield': this.battlefield.export(),
        'players': this.players.map(function(element) {return element.export()}),
        'attackingPlayer': this.attackingPlayer,
        'defendingPlayer': this.defendingPlayer,
        'trumpCard': this.trumpCard.getString(),
        'playersRemaining': this.playersRemaining,
        'deck': this.deck.export(),
        'lastAttacker': this.lastAttacker
    };
}

durak.game.Game.prototype.parseCard = function(cardString) {
    var suit = cardString.charAt(cardString.length - 1);
    var rank = durak.game.ParseRanks[cardString.substring(0, cardString.length - 1)];
    
    return new durak.game.Card(suit, rank);
}

durak.game.Game.prototype.sendRPC = function(method) {
    this.xhr.send(serverPath + method, opt_method = 'POST',
             opt_content = this.serializer.serialize(this.export()));
}

durak.game.Game.prototype.processCallback = function(e) {
    var response = this.xhr.getResponseJson();

    if (this.state == GameStates.WAITING_FOR_ATTACK_RPC) {
        this.AIAttack(response);
        return;
    } else if (this.state == GameStates.WAITING_FOR_DEFENSE_RPC) {
        this.AIDefense(response);
        return;
    } else {
        alert('oops, invalid state.');
    }
}

durak.game.Game.prototype.AIAttack = function(response) {
    if (response == null) {
        updateStatusText(this.players[this.attackingPlayer].name + ' passes.');
        this.players[this.attackingPlayer].playedAttack = false;
    } else {
        for (var i = 0; i < response.length; i++) {
            var cardToPlay = this.parseCard(response[i]);
            
            var removeIndex = -1;
            for (var j = 0; j < this.players[this.attackingPlayer].hand.length; j++) {
                if (cardToPlay.equals(this.players[this.attackingPlayer].hand[j])) {
                    removeIndex = j;
                    break;
                }
            }
            
            var playedCard = this.players[this.attackingPlayer].removeCard(removeIndex);
            this.battlefield.addAttack(playedCard);
        }

        updateStatusText(this.players[this.attackingPlayer].name + ' plays an attack.');
        this.players[this.attackingPlayer].playedAttack = true;
        this.lastAttacker = this.attackingPlayer;
    }
    
    if (this.deck.deck.length == 0) {
        this.players[this.attackingPlayer].checkIfOut();
    }
    this.state = GameStates.AFTER_AI_ATTACK;
    waitForNext();
}

durak.game.Game.prototype.AIDefense = function(response) {
    if (response == null) {
        this.surrender();
    } else {
        for (var i = 0; i < response.length; i++) {
            if (response[i] == null) {
                continue;
            }
            
            var cardToPlay = this.parseCard(response[i]);
            
            var removeIndex = -1;
            for (var j = 0; j < this.players[this.defendingPlayer].hand.length; j++) {
                if (cardToPlay.equals(this.players[this.defendingPlayer].hand[j])) {
                    removeIndex = j;
                    break;
                }
            }
            
            var playedCard = this.players[this.defendingPlayer].removeCard(removeIndex);
            this.battlefield.addDefense(playedCard, i);
        }
        
        for (var i = 0; i < this.players.length; i++) {
            if (this.players[i].active) {
                this.players[i].playedAttack = true;
            }
        }
        updateStatusText(this.players[this.defendingPlayer].name + ' defends.');
    }

    if (this.deck.deck.length == 0) {
        this.players[this.defendingPlayer].checkIfOut();
    }
    this.state = GameStates.AFTER_DEFENSE;
    waitForNext();
}

var game;
var dealButton;
var passButton;
var serializer;
var surrenderButton;
var statusText;
var serverPath = 'http://127.0.0.1:8080/';


function waitForNext() {
    if (game.state == GameStates.PLAYER_ATTACK) {
        passButton.value = 'Pass';
    } else {
        passButton.value = 'Next';
    }
    passButton.style.display = 'inline';
}

function updateStatusText(newText) {
    statusText.innerHTML = newText;
}

function init() {
    game = new durak.game.Game();

    dealButton = goog.dom.createDom('input',
      {'type': 'button', 'value': 'Deal'});
    passButton = goog.dom.createDom('input',
      {'type': 'button', 'value': 'Pass', 'style': 'display: none'});
    surrenderButton = goog.dom.createDom('input',
      {'type': 'button', 'value': 'Surrender', 'style': 'display: none'});

    statusText = document.getElementById('status_text');
    var buttons = document.getElementById('buttons');
    buttons.appendChild(dealButton);
    buttons.appendChild(passButton);
    buttons.appendChild(surrenderButton);
    goog.events.listen(dealButton, goog.events.EventType.CLICK,
                       game.deal, false, game);
    goog.events.listen(passButton, goog.events.EventType.CLICK,
                       game.nextPhase, false, game);
    goog.events.listen(surrenderButton, goog.events.EventType.CLICK,
                       game.playerSurrender, false, game);
}
