goog.provide('durak.game');
goog.provide('durak.game.Suits');
goog.provide('durak.game.Ranks');
goog.provide('durak.game.Card');

goog.require('goog.dom');

durak.game.Suits = {
    CLUBS: 'C',
    HEARTS: 'H',
    SPADES: 'S',
    DIAMONDS: 'D'
};

durak.game.Ranks = {
    ACE: 'ace',
    TWO: '2',
    THREE: '3',
    FOUR: '4',
    FIVE: '5',
    SIX: '6',
    SEVEN: '7',
    EIGHT: '8',
    NINE: '9',
    TEN: '10',
    JACK: 'jack',
    QUEEN: 'queen',
    KING: 'king'
}

durak.game.Card = function(suit, rank) {
    this.suit = suit
    this.rank = rank
}
