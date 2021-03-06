import {
  SEND_CHANNEL,
  SUBSCRIBE,
  UNSUBSCRIBE
} from './constants'

/**
 * Base class for Stream subscriptions
 */
export default class BaseStream {
  /**
   * Constructor
   * @param io socket instance
   * @param channel type of messages that will be handle
   * @param debug debug instance to categorize correctly by the identifier that defines the inherit class
   */
  constructor (io, channel, debug) {
    this.subscriptions = {}
    this.io = io
    this.channel = channel
    this._debug = debug
  }

  /**
   * Emit a SUBSCRIBE message to SEND_CHANNEL with the payload
   * @param payload
   */
  subscribe (payload) {
    const message = {type: SUBSCRIBE, channel: this.channel, payload}
    this._debug('subscribing %s with params %s', SEND_CHANNEL, message)
    this.io.emit(SEND_CHANNEL, message)
  }

  /**
   * Store a subscription with key channelId
   * All subscriptions are composed of callback and unsubscribe function
   * @param channelId identifier of subscription
   * @param unsubscriptionParams params needed to call backend for unsubsctiption
   * @param callback function will ve invoked when a message is received
   * @returns {*} the subscription
   * @private
   */
  _addSubscription (channelId, unsubscriptionParams, callback) {
    const unsubscribeFn = (channelId, channel, payload) => {
      return () => {
        this._debug('unsubscribe %s with params %O', channelId, payload)
        this.io.emit(SEND_CHANNEL, {
          type: UNSUBSCRIBE,
          channel: channel,
          payload: payload
        })
        delete this.subscriptions[channelId]
      }
    }

    const resubscribeFn = (channelId, channel, payload) => {
      return () => {
        payload.snapshot = false
        this._debug('resubscribe %s with params %O', channelId, payload)
        this.io.emit(SEND_CHANNEL, {
          type: SUBSCRIBE,
          channel: channel,
          payload: payload
        })
      }
    }

    this.subscriptions[channelId] = {
      callback: callback,
      unsubscribe: unsubscribeFn.call(this, channelId, this.channel, unsubscriptionParams),
      resubscribe: resubscribeFn.call(this, channelId, this.channel, unsubscriptionParams)
    }

    return this.subscriptions[channelId]
  }

  /**
   * Unsubscribe all
   * this function invoke all unsubscribe functions and clean the registry of subscriptions
   */
  unsubscribeAll () {
    Object.keys(this.subscriptions).forEach(key => {
      this.subscriptions[key].unsubscribe()
      delete this.subscriptions[key]
    })
  }

  resubscribeAll () {
    Object.keys(this.subscriptions).forEach(key => {
      this.subscriptions[key].resubscribe()
    })
  }

  /**
   * Handler of message.All message received at this point must be of the same type.
   * Not is a global handler
   * @param msg Message received from backend
   */
  handleMessage (msg) {
    this._debug('received', msg)
    const channelId = msg.channelId
    if (this.subscriptions[channelId]) {
      this.subscriptions[channelId].callback(msg)
    } else {
      this._debug('not event handler for ', channelId)
    }
  }
}
