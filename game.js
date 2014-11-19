goog.provide('durak.game');
goog.provide('durak.game.Game');
goog.provide('durak.game.Card');
goog.provide('durak.game.Deck');
goog.provide('durak.game.Player');
goog.provide('durak.game.Battlefield');

goog.require('goog.dom');
goog.require('goog.dom.classes');
goog.require('goog.events');
goog.require('goog.ui.Button');

durak.game.Suits = {
    CLUBS: 'C',
    HEARTS: 'H',
    SPADES: 'S',
    DIAMONDS: 'D'
};

durak.game.Ranks = {
    SIX: '6',
    SEVEN: '7',
    EIGHT: '8',
    NINE: '9',
    TEN: '10',
    JACK: 'J',
    QUEEN: 'Q',
    KING: 'K',
    ACE: 'A'
};

durak.game.Ranks.RankNames = {
    1: '6',
    2: '7',
    3: '8',
    this.suit = suit
    this.rank = rank
    4: '9',
    5: '10',
    JACK: 'J',
    QUEEN: 'Q',
    KING: 'K',
    ACE: 'A'
}

durak.game.Card = function(suit, rank) {
    this.suit = suit;
    this.rank = rank;
    this.imageElement = goog.dom.createDom('img',
            {'class': 'card',
             'src': this.getImageName()});
};

durak.game.Card.prototype.getImageName = function() {
    return 'img/' + this.rank + this.suit + '.png';
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
        var listElement = goog.dom.createDom('li', null, card.imageElement);

        goog.dom.appendChild(this.handList, listElement);
        goog.events.listen(card.imageElement, goog.events.EventType.CLICK, this.selectCard, false, this);
    } else {
        this.countElement.innerHTML = this.hand.length;
    }
};

durak.game.Player.prototype.removeCard = function(index) {
    var card= this.hand[index]
    this.hand.splice(index, 1);
    if (this.human) {
        goog.dom.removeNode(card.imageElement);
    } else {
        this.countElement.innerHTML = this.hand.length;
    }

    return card;
}

durak.game.Player.prototype.selectCard = function(e) {
    if (game.state != GameStates.PLAYER_ATTACK) {
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
    this.selectedCard = null;
    this.selectedIndex = -1;
    for(var i = 0; i < this.hand.length; i++) {
        goog.dom.classes.remove(this.hand[i].imageElement, 'selected');
    }
}

durak.game.Player.prototype.setStatus = function(status) {
    this.status = status;
    this.statusElement.innerHTML = status;
    goog.dom.classes.add(this.contentElement, status);
}

durak.game.Player.prototype.removeStatus = function() {
    goog.dom.classes.remove(this.contentElement, this.status);
    this.status = null;
    this.statusElement.innerHTML = '';
}

durak.game.Player.prototype.AIAttack = function(game) {
    if (game.battlefield.attacks.length > 0) {
        updateStatusText(this.name + ' passes.');
        this.playedAttack = false;
        return;
    }

    var card = this.removeCard(Math.floor(Math.random() * this.hand.length));
    updateStatusText(this.name + ' plays an attack.');
    this.playedAttack = true;
    game.battlefield.addAttack(card);
}

durak.game.Player.prototype.AIDefense = function(game) {
    game.surrender();
}

durak.game.Battlefield = function() {
    this.attacks = [];
    this.blocks = [];
    this.validRanks = new Set();
    this.contentElement = document.getElementById('battlefield');
    this.attackingSlot = goog.dom.createDom('div', {'id':'attacking_slot'});
    goog.events.listen(this.attackingSlot, goog.events.EventType.CLICK,
                       this.makePlayerAttack, false, this);
}

durak.game.Battlefield.prototype.addAttack = function(card) {
    if (!this.validRanks.has(card.rank) && this.validRanks.size != 0) {
        return;
    }

    var divDom = goog.dom.createDom('div', null, card.imageElement);
    goog.dom.appendChild(this.contentElement, divDom);
    this.attacks.push(card);
    this.validRanks.add(card.rank);
}

durak.game.Battlefield.prototype.hasNewAttacks = function() {
    return this.attacks.length > this.blocks.length;
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
        this.addAttackingSlot();
        game.players[game.attackingPlayer].playedAttack = true;
        updateStatusText('Play an attack, or pass.');
        waitForNext();
    }
    game.players[game.attackingPlayer].deselectCards();
}

var GameStates = {
    AFTER_AI_ATTACK: 0,
    AFTER_AI_DEFENSE: 1,
    PLAYER_ATTACK: 2
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
    this.state = 0;
    this.trumpSuit = null;
    this.attackingPlayer = 0;
    this.defendingPlayer = 0;
};

durak.game.Game.prototype.deal = function() {
    for (var j = 0; j < this.players.length; j++) {
        this.players[j].init();
    }

    this.deck = new durak.game.Deck();
    this.deck.shuffle();

    for (var i = 0; i < 6; i++) {
        for (var j = 0; j < this.players.length; j++) {
            this.players[j].addCard(this.deck.draw());
        }
    }

    var trumpCard = this.deck.getTrump();
    this.trumpSuit = trumpCard.suit;
    this.deck.trumpElement.style.display = 'inline';
    this.deck.trumpElement.style.visibility = 'visible';
    this.deck.trumpElement.src = trumpCard.getImageName();
    this.deck.deckElement.style.visibility = 'visible';
    dealButton.style.display = 'none';

    this.attackingPlayer = 0;
    this.defendingPlayer = 1;
    this.initiateRound();
};

durak.game.Game.prototype.initiateRound = function() {
    for (var i = 0; i < this.players.length; i++) {
        this.players[i].playedAttack = false;
    }

    this.players[this.attackingPlayer].setStatus('attacking');
    this.players[this.defendingPlayer].setStatus('defending');

    this.attack();
}

durak.game.Game.prototype.attack = function() {
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
        this.players[this.attackingPlayer].AIAttack(this);
        this.state = GameStates.AFTER_AI_ATTACK;
        waitForNext();
    }
}

durak.game.Game.prototype.defend = function() {
    if (this.players[this.defendingPlayer].human) {
    } else {
        this.players[this.defendingPlayer].AIDefense(this);
        this.state = GameStates.AFTER_AI_DEFENSE;
        waitForNext();
    }
}

durak.game.Game.prototype.surrender = function() {
    updateStatusText(this.players[this.defendingPlayer].name + ' surrenders.');
    this.players[this.defendingPlayer].setStatus('surrendered');
}

durak.game.Game.prototype.nextAttacker = function() {
    this.players[this.attackingPlayer].removeStatus();

    this.attackingPlayer = this.incrementPlayer(this.attackingPlayer);

    while (!this.players[this.attackingPlayer].active || this.attackingPlayer == this.defendingPlayer) {
        this.attackingPlayer = this.incrementPlayer(this.attackingPlayer);
    }

    this.players[this.attackingPlayer].setStatus('attacking');
}

durak.game.Game.prototype.incrementPlayer = function(p) {
    p += 1;
    if (p >= this.players.length) {
        p = 0;
    }

    return p;
}

durak.game.Game.prototype.endRound = function() {
    if (this.players[this.defendingPlayer].status == 'surrendered') {

    }
}

durak.game.Game.prototype.nextPhase = function() {
    passButton.style.display = 'none';

    var noAttacks = true;
    for (int i = 0; i < this.players.length; i++) {
        if (this.players[i].playedAttack) {
            noAttacks = false;
            break;
        }
    }

    if (noAttacks) {
        this.endRound();
    }

    if (this.state == GameStates.AFTER_AI_ATTACK || this.state == GameStates.PLAYER_ATTACK) {
        if(this.state = GameStates.PLAYER_ATTACK) {
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
    } else if (this.state == GameStates.AFTER_AI_DEFENSE) {
        this.attack();
    }
}


var game;
var dealButton;
var passButton;
var surrenderButton;
var statusText;

function waitForNext() {
    if (game.state == GameStates.PLAYER_ATTACK) {
        passButton.value = 'Pass';
    } else{
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
    var informationBox = document.getElementById('information');
    informationBox.appendChild(dealButton);
    informationBox.appendChild(passButton);
    informationBox.appendChild(surrenderButton);
    goog.events.listen(dealButton, goog.events.EventType.CLICK,
                       game.deal, false, game);
    goog.events.listen(passButton, goog.events.EventType.CLICK,
                       game.nextPhase, false, game);

}
