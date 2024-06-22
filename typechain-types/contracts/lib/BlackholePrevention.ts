/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */
import type {
  BaseContract,
  BigNumberish,
  FunctionFragment,
  Interface,
  EventFragment,
  AddressLike,
  ContractRunner,
  ContractMethod,
  Listener,
} from "ethers";
import type {
  TypedContractEvent,
  TypedDeferredTopicFilter,
  TypedEventLog,
  TypedLogDescription,
  TypedListener,
} from "../../common";

export interface BlackholePreventionInterface extends Interface {
  getEvent(
    nameOrSignatureOrTopic:
      | "WithdrawStuckERC1155"
      | "WithdrawStuckERC20"
      | "WithdrawStuckERC721"
      | "WithdrawStuckEther"
  ): EventFragment;
}

export namespace WithdrawStuckERC1155Event {
  export type InputTuple = [
    receiver: AddressLike,
    tokenAddress: AddressLike,
    tokenId: BigNumberish,
    amount: BigNumberish
  ];
  export type OutputTuple = [
    receiver: string,
    tokenAddress: string,
    tokenId: bigint,
    amount: bigint
  ];
  export interface OutputObject {
    receiver: string;
    tokenAddress: string;
    tokenId: bigint;
    amount: bigint;
  }
  export type Event = TypedContractEvent<InputTuple, OutputTuple, OutputObject>;
  export type Filter = TypedDeferredTopicFilter<Event>;
  export type Log = TypedEventLog<Event>;
  export type LogDescription = TypedLogDescription<Event>;
}

export namespace WithdrawStuckERC20Event {
  export type InputTuple = [
    receiver: AddressLike,
    tokenAddress: AddressLike,
    amount: BigNumberish
  ];
  export type OutputTuple = [
    receiver: string,
    tokenAddress: string,
    amount: bigint
  ];
  export interface OutputObject {
    receiver: string;
    tokenAddress: string;
    amount: bigint;
  }
  export type Event = TypedContractEvent<InputTuple, OutputTuple, OutputObject>;
  export type Filter = TypedDeferredTopicFilter<Event>;
  export type Log = TypedEventLog<Event>;
  export type LogDescription = TypedLogDescription<Event>;
}

export namespace WithdrawStuckERC721Event {
  export type InputTuple = [
    receiver: AddressLike,
    tokenAddress: AddressLike,
    tokenId: BigNumberish
  ];
  export type OutputTuple = [
    receiver: string,
    tokenAddress: string,
    tokenId: bigint
  ];
  export interface OutputObject {
    receiver: string;
    tokenAddress: string;
    tokenId: bigint;
  }
  export type Event = TypedContractEvent<InputTuple, OutputTuple, OutputObject>;
  export type Filter = TypedDeferredTopicFilter<Event>;
  export type Log = TypedEventLog<Event>;
  export type LogDescription = TypedLogDescription<Event>;
}

export namespace WithdrawStuckEtherEvent {
  export type InputTuple = [receiver: AddressLike, amount: BigNumberish];
  export type OutputTuple = [receiver: string, amount: bigint];
  export interface OutputObject {
    receiver: string;
    amount: bigint;
  }
  export type Event = TypedContractEvent<InputTuple, OutputTuple, OutputObject>;
  export type Filter = TypedDeferredTopicFilter<Event>;
  export type Log = TypedEventLog<Event>;
  export type LogDescription = TypedLogDescription<Event>;
}

export interface BlackholePrevention extends BaseContract {
  connect(runner?: ContractRunner | null): BlackholePrevention;
  waitForDeployment(): Promise<this>;

  interface: BlackholePreventionInterface;

  queryFilter<TCEvent extends TypedContractEvent>(
    event: TCEvent,
    fromBlockOrBlockhash?: string | number | undefined,
    toBlock?: string | number | undefined
  ): Promise<Array<TypedEventLog<TCEvent>>>;
  queryFilter<TCEvent extends TypedContractEvent>(
    filter: TypedDeferredTopicFilter<TCEvent>,
    fromBlockOrBlockhash?: string | number | undefined,
    toBlock?: string | number | undefined
  ): Promise<Array<TypedEventLog<TCEvent>>>;

  on<TCEvent extends TypedContractEvent>(
    event: TCEvent,
    listener: TypedListener<TCEvent>
  ): Promise<this>;
  on<TCEvent extends TypedContractEvent>(
    filter: TypedDeferredTopicFilter<TCEvent>,
    listener: TypedListener<TCEvent>
  ): Promise<this>;

  once<TCEvent extends TypedContractEvent>(
    event: TCEvent,
    listener: TypedListener<TCEvent>
  ): Promise<this>;
  once<TCEvent extends TypedContractEvent>(
    filter: TypedDeferredTopicFilter<TCEvent>,
    listener: TypedListener<TCEvent>
  ): Promise<this>;

  listeners<TCEvent extends TypedContractEvent>(
    event: TCEvent
  ): Promise<Array<TypedListener<TCEvent>>>;
  listeners(eventName?: string): Promise<Array<Listener>>;
  removeAllListeners<TCEvent extends TypedContractEvent>(
    event?: TCEvent
  ): Promise<this>;

  getFunction<T extends ContractMethod = ContractMethod>(
    key: string | FunctionFragment
  ): T;

  getEvent(
    key: "WithdrawStuckERC1155"
  ): TypedContractEvent<
    WithdrawStuckERC1155Event.InputTuple,
    WithdrawStuckERC1155Event.OutputTuple,
    WithdrawStuckERC1155Event.OutputObject
  >;
  getEvent(
    key: "WithdrawStuckERC20"
  ): TypedContractEvent<
    WithdrawStuckERC20Event.InputTuple,
    WithdrawStuckERC20Event.OutputTuple,
    WithdrawStuckERC20Event.OutputObject
  >;
  getEvent(
    key: "WithdrawStuckERC721"
  ): TypedContractEvent<
    WithdrawStuckERC721Event.InputTuple,
    WithdrawStuckERC721Event.OutputTuple,
    WithdrawStuckERC721Event.OutputObject
  >;
  getEvent(
    key: "WithdrawStuckEther"
  ): TypedContractEvent<
    WithdrawStuckEtherEvent.InputTuple,
    WithdrawStuckEtherEvent.OutputTuple,
    WithdrawStuckEtherEvent.OutputObject
  >;

  filters: {
    "WithdrawStuckERC1155(address,address,uint256,uint256)": TypedContractEvent<
      WithdrawStuckERC1155Event.InputTuple,
      WithdrawStuckERC1155Event.OutputTuple,
      WithdrawStuckERC1155Event.OutputObject
    >;
    WithdrawStuckERC1155: TypedContractEvent<
      WithdrawStuckERC1155Event.InputTuple,
      WithdrawStuckERC1155Event.OutputTuple,
      WithdrawStuckERC1155Event.OutputObject
    >;

    "WithdrawStuckERC20(address,address,uint256)": TypedContractEvent<
      WithdrawStuckERC20Event.InputTuple,
      WithdrawStuckERC20Event.OutputTuple,
      WithdrawStuckERC20Event.OutputObject
    >;
    WithdrawStuckERC20: TypedContractEvent<
      WithdrawStuckERC20Event.InputTuple,
      WithdrawStuckERC20Event.OutputTuple,
      WithdrawStuckERC20Event.OutputObject
    >;

    "WithdrawStuckERC721(address,address,uint256)": TypedContractEvent<
      WithdrawStuckERC721Event.InputTuple,
      WithdrawStuckERC721Event.OutputTuple,
      WithdrawStuckERC721Event.OutputObject
    >;
    WithdrawStuckERC721: TypedContractEvent<
      WithdrawStuckERC721Event.InputTuple,
      WithdrawStuckERC721Event.OutputTuple,
      WithdrawStuckERC721Event.OutputObject
    >;

    "WithdrawStuckEther(address,uint256)": TypedContractEvent<
      WithdrawStuckEtherEvent.InputTuple,
      WithdrawStuckEtherEvent.OutputTuple,
      WithdrawStuckEtherEvent.OutputObject
    >;
    WithdrawStuckEther: TypedContractEvent<
      WithdrawStuckEtherEvent.InputTuple,
      WithdrawStuckEtherEvent.OutputTuple,
      WithdrawStuckEtherEvent.OutputObject
    >;
  };
}
