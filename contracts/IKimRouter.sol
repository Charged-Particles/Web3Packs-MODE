struct ExactInputSingleParams {
  address tokenIn;
  address tokenOut;
  address recipient;
  uint256 deadline;
  uint256 amountIn;
  uint256 amountOutMinimum;
  uint160 limitSqrtPrice;
}
interface IKimRouter {
  function exactInputSingle(
      ExactInputSingleParams calldata params
  ) external payable returns (uint256 amountOut);
}
