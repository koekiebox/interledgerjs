import { Reader, Writer } from 'oer-utils'
import { dateToGeneralizedTime, generalizedTimeToDate } from './src/utils/date'
import { stringToTwoNumbers, twoNumbersToString } from './src/utils/uint64'
import base64url from 'base64url-adhoc'
import Long = require('long')

enum Type {
  TYPE_ILP_PAYMENT = 1,
  TYPE_ILQP_LIQUIDITY_REQUEST = 2,
  TYPE_ILQP_LIQUIDITY_RESPONSE = 3,
  TYPE_ILQP_BY_SOURCE_REQUEST = 4,
  TYPE_ILQP_BY_SOURCE_RESPONSE = 5,
  TYPE_ILQP_BY_DESTINATION_REQUEST = 6,
  TYPE_ILQP_BY_DESTINATION_RESPONSE = 7
}

const serializeEnvelope = (type: number, contents: Buffer) => {
  const writer = new Writer()
  writer.writeUInt8(type)
  writer.writeVarOctetString(contents)
  return writer.getBuffer()
}

const deserializeEnvelope = (binary: Buffer) => {
  const envelopeReader = Reader.from(binary)
  const type = envelopeReader.readUInt8()
  const contents = envelopeReader.readVarOctetString()

  return { type, contents }
}

interface IlpPayment {
  amount: string,
  account: string,
  data: string
}

const serializeIlpPayment = (json: IlpPayment) => {
  const writer = new Writer()

  // amount
  const amount = Long.fromString(json.amount, true)
  writer.writeUInt32(amount.getHighBitsUnsigned())
  writer.writeUInt32(amount.getLowBitsUnsigned())

  // account
  writer.writeVarOctetString(Buffer.from(json.account, 'ascii'))

  // data
  writer.writeVarOctetString(Buffer.from(json.data || '', 'base64'))

  // extensibility
  writer.writeUInt8(0)

  return serializeEnvelope(Type.TYPE_ILP_PAYMENT, writer.getBuffer())
}

const deserializeIlpPayment = (binary: Buffer): IlpPayment => {
  const { type, contents } = deserializeEnvelope(binary)

  if (type !== Type.TYPE_ILP_PAYMENT) {
    throw new Error('Packet has incorrect type')
  }

  const reader = Reader.from(contents)

  const highBits = reader.readUInt32()
  const lowBits = reader.readUInt32()
  const amount = Long.fromBits(lowBits, highBits, true).toString()
  const account = reader.readVarOctetString().toString('ascii')
  const data = base64url(reader.readVarOctetString())

  // Ignore remaining bytes for extensibility

  return {
    amount,
    account,
    data
  }
}

interface IlqpLiquidityRequest {
  destinationAccount: string,
  destinationHoldDuration: number
}

const serializeIlqpLiquidityRequest = (json: IlqpLiquidityRequest) => {
  const writer = new Writer()

  // destinationAccount
  writer.writeVarOctetString(Buffer.from(json.destinationAccount, 'ascii'))

  // destinationHoldDuration
  writer.writeUInt32(json.destinationHoldDuration)

  // extensibility
  writer.writeUInt8(0)

  return serializeEnvelope(Type.TYPE_ILQP_LIQUIDITY_REQUEST, writer.getBuffer())
}

const deserializeIlqpLiquidityRequest = (binary: Buffer): IlqpLiquidityRequest => {
  const { type, contents } = deserializeEnvelope(binary)

  if (type !== Type.TYPE_ILQP_LIQUIDITY_REQUEST) {
    throw new Error('Packet has incorrect type')
  }

  const reader = Reader.from(contents)

  const destinationAccount = reader.readVarOctetString().toString('ascii')

  const destinationHoldDuration = reader.readUInt32()

  // Ignore remaining bytes for extensibility

  return {
    destinationAccount,
    destinationHoldDuration
  }
}

interface IlqpLiquidityResponse {
  liquidityCurve: Buffer,
  appliesToPrefix: string,
  sourceHoldDuration: number,
  expiresAt: Date
}

// Each point in a liquidity curve is two UInt64s
const SIZE_OF_POINT = 16

const serializeIlqpLiquidityResponse = (json: IlqpLiquidityResponse) => {
  const writer = new Writer()

  // liquidityCurve
  if (json.liquidityCurve.length % SIZE_OF_POINT !== 0) {
    throw new Error(
      'invalid liquidity curve, length must be multiple of ' +
      SIZE_OF_POINT + ', but was: ' +
      json.liquidityCurve.length
    )
  }
  writer.writeVarUInt(json.liquidityCurve.length / SIZE_OF_POINT)
  writer.write(json.liquidityCurve)

  // appliesToPrefix
  writer.writeVarOctetString(Buffer.from(json.appliesToPrefix, 'ascii'))

  // sourceHoldDuration
  writer.writeUInt32(json.sourceHoldDuration)

  // expiresAt
  writer.writeVarOctetString(Buffer.from(dateToGeneralizedTime(json.expiresAt), 'ascii'))

  // extensibility
  writer.writeUInt8(0)

  return serializeEnvelope(Type.TYPE_ILQP_LIQUIDITY_RESPONSE, writer.getBuffer())
}

const deserializeIlqpLiquidityResponse = (binary: Buffer): IlqpLiquidityResponse => {
  const { type, contents } = deserializeEnvelope(binary)

  if (type !== Type.TYPE_ILQP_LIQUIDITY_RESPONSE) {
    throw new Error('Packet has incorrect type')
  }

  const reader = Reader.from(contents)

  const numPoints = reader.readVarUInt()
  const liquidityCurve = reader.read(numPoints * SIZE_OF_POINT)

  const appliesToPrefix = reader.readVarOctetString().toString('ascii')

  const sourceHoldDuration = reader.readUInt32()

  const expiresAt = generalizedTimeToDate(reader.readVarOctetString().toString('ascii'))

  // Ignore remaining bytes for extensibility

  return {
    liquidityCurve,
    appliesToPrefix,
    sourceHoldDuration,
    expiresAt
  }
}

interface IlqpBySourceRequest {
  destinationAccount: string,
  sourceAmount: string,
  destinationHoldDuration: number,
}

const serializeIlqpBySourceRequest = (json: IlqpBySourceRequest) => {
  const writer = new Writer()

  // destinationAccount
  writer.writeVarOctetString(Buffer.from(json.destinationAccount, 'ascii'))

  // sourceAmount
  writer.writeUInt64(stringToTwoNumbers(json.sourceAmount))

  // destinationHoldDuration
  writer.writeUInt32(json.destinationHoldDuration)

  // extensibility
  writer.writeUInt8(0)

  return serializeEnvelope(Type.TYPE_ILQP_BY_SOURCE_REQUEST, writer.getBuffer())
}

const deserializeIlqpBySourceRequest = (binary: Buffer): IlqpBySourceRequest => {
  const { type, contents } = deserializeEnvelope(binary)

  if (type !== Type.TYPE_ILQP_BY_SOURCE_REQUEST) {
    throw new Error('Packet has incorrect type')
  }

  const reader = Reader.from(contents)

  const destinationAccount = reader.readVarOctetString().toString('ascii')

  const sourceAmount = twoNumbersToString(reader.readUInt64())

  const destinationHoldDuration = reader.readUInt32()

  // Ignore remaining bytes for extensibility

  return {
    destinationAccount,
    sourceAmount,
    destinationHoldDuration
  }
}

interface IlqpBySourceResponse {
  destinationAmount: string,
  sourceHoldDuration: number,
}

const serializeIlqpBySourceResponse = (json: IlqpBySourceResponse) => {
  const writer = new Writer()

  // destinationAmount
  // TODO: Proper UInt64 support
  writer.writeUInt64(stringToTwoNumbers(json.destinationAmount))

  // sourceHoldDuration
  writer.writeUInt32(json.sourceHoldDuration)

  // extensibility
  writer.writeUInt8(0)

  return serializeEnvelope(Type.TYPE_ILQP_BY_SOURCE_RESPONSE, writer.getBuffer())
}

const deserializeIlqpBySourceResponse = (binary: Buffer): IlqpBySourceResponse => {
  const { type, contents } = deserializeEnvelope(binary)

  if (type !== Type.TYPE_ILQP_BY_SOURCE_RESPONSE) {
    throw new Error('Packet has incorrect type')
  }

  const reader = Reader.from(contents)

  const destinationAmount = twoNumbersToString(reader.readUInt64())

  const sourceHoldDuration = reader.readUInt32()

  // Ignore remaining bytes for extensibility

  return {
    destinationAmount,
    sourceHoldDuration
  }
}

interface IlqpByDestinationRequest {
  destinationAccount: string,
  destinationAmount: string,
  destinationHoldDuration: number,
}

const serializeIlqpByDestinationRequest = (json: IlqpByDestinationRequest) => {
  const writer = new Writer()

  // destinationAccount
  writer.writeVarOctetString(Buffer.from(json.destinationAccount, 'ascii'))

  // destinationAmount
  writer.writeUInt64(stringToTwoNumbers(json.destinationAmount))

  // destinationHoldDuration
  writer.writeUInt32(json.destinationHoldDuration)

  // extensibility
  writer.writeUInt8(0)

  return serializeEnvelope(Type.TYPE_ILQP_BY_DESTINATION_REQUEST, writer.getBuffer())
}

const deserializeIlqpByDestinationRequest = (binary: Buffer): IlqpByDestinationRequest => {
  const { type, contents } = deserializeEnvelope(binary)

  if (type !== Type.TYPE_ILQP_BY_DESTINATION_REQUEST) {
    throw new Error('Packet has incorrect type')
  }

  const reader = Reader.from(contents)

  const destinationAccount = reader.readVarOctetString().toString('ascii')

  const destinationAmount = twoNumbersToString(reader.readUInt64())

  const destinationHoldDuration = reader.readUInt32()

  // Ignore remaining bytes for extensibility

  return {
    destinationAccount,
    destinationAmount,
    destinationHoldDuration
  }
}

interface IlqpByDestinationResponse {
  sourceAmount: string,
  sourceHoldDuration: number,
}

const serializeIlqpByDestinationResponse = (json: IlqpByDestinationResponse) => {
  const writer = new Writer()

  // destinationAmount
  // TODO: Proper UInt64 support
  writer.writeUInt64(stringToTwoNumbers(json.sourceAmount))

  // sourceHoldDuration
  writer.writeUInt32(json.sourceHoldDuration)

  // extensibility
  writer.writeUInt8(0)

  return serializeEnvelope(Type.TYPE_ILQP_BY_DESTINATION_RESPONSE, writer.getBuffer())
}

const deserializeIlqpByDestinationResponse = (binary: Buffer): IlqpByDestinationResponse => {
  const { type, contents } = deserializeEnvelope(binary)

  if (type !== Type.TYPE_ILQP_BY_DESTINATION_RESPONSE) {
    throw new Error('Packet has incorrect type')
  }

  const reader = Reader.from(contents)

  const sourceAmount = twoNumbersToString(reader.readUInt64())

  const sourceHoldDuration = reader.readUInt32()

  // Ignore remaining bytes for extensibility

  return {
    sourceAmount,
    sourceHoldDuration
  }
}

module.exports = {
  Type,
  serializeIlpPayment,
  deserializeIlpPayment,
  serializeIlqpLiquidityRequest,
  deserializeIlqpLiquidityRequest,
  serializeIlqpLiquidityResponse,
  deserializeIlqpLiquidityResponse,
  serializeIlqpBySourceRequest,
  deserializeIlqpBySourceRequest,
  serializeIlqpBySourceResponse,
  deserializeIlqpBySourceResponse,
  serializeIlqpByDestinationRequest,
  deserializeIlqpByDestinationRequest,
  serializeIlqpByDestinationResponse,
  deserializeIlqpByDestinationResponse
}
