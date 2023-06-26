import { BigNumber } from "ethers";
import { useState } from "react";

import { ensureERC20Allowance } from "@/lib/contracts-shortcuts";
import { formatEther } from "@/lib/format";
import { safeParseEther } from "@/lib/utils";
import useDeployedContracts from "../lib/hooks/contracts/use-deployed-contracts";
import useManagerManaged from "../lib/hooks/contracts/use-manager-managed";
import useBalances from "../lib/hooks/use-balances";
import useSigner from "../lib/hooks/use-signer";
import useTransactionLogger from "../lib/hooks/use-transaction-logger";
import useWalletAddress from "../lib/hooks/use-wallet-address";
import Button from "../ui/button";
import PositiveNumberInput from "../ui/positive-number-input";

const UcrNftGenerator = () => {
  const [walletAddress] = useWalletAddress();
  const signer = useSigner();
  const [balances, refreshBalances] = useBalances();
  const [, doTransaction, doingTransaction] = useTransactionLogger();
  const deployedContracts = useDeployedContracts();
  const managedContracts = useManagerManaged();

  const [inputVal, setInputVal] = useState("");
  const [expectedDebtCoupon, setExpectedDebtCoupon] = useState<BigNumber | null>(null);

  if (!walletAddress || !signer) {
    return <span>Connect wallet</span>;
  }

  if (!balances || !managedContracts || !deployedContracts) {
    return <span>· · ·</span>;
  }

  const depositDollarForDebtCoupons = async (amount: BigNumber) => {
    const { debtCouponManager } = deployedContracts;
    // cspell: disable-next-line
    await ensureERC20Allowance("uAD -> DebtCouponManager", managedContracts.dollarToken, amount, signer, debtCouponManager.address);
    await (await debtCouponManager.connect(signer).exchangeDollarsForCreditNft(amount)).wait();
    refreshBalances();
  };

  const handleBurn = async () => {
    const amount = extractValidAmount();
    if (amount) {
      // cspell: disable-next-line
      doTransaction("Burning uAD...", async () => {
        setInputVal("");
        await depositDollarForDebtCoupons(amount);
      });
    }
  };

  const handleInput = async (val: string) => {
    setInputVal(val);
    const amount = extractValidAmount(val);
    if (amount) {
      setExpectedDebtCoupon(null);
      setExpectedDebtCoupon(await managedContracts.creditNftCalculator.connect(signer).getCreditNftAmount(amount));
    }
  };

  const extractValidAmount = (val: string = inputVal): null | BigNumber => {
    const amount = safeParseEther(val);
    return amount && amount.gt(BigNumber.from(0)) && amount.lte(balances.uad) ? amount : null;
  };

  const submitEnabled = !!(extractValidAmount() && !doingTransaction);

  return (
    <div>
      {/* cspell: disable-next-line */}
      <PositiveNumberInput value={inputVal} onChange={handleInput} placeholder="uAD Amount" />
      <Button onClick={handleBurn} disabled={!submitEnabled}>
        {/* cspell: disable-next-line */}
        Redeem uAD for uCR-NFT
      </Button>
      {expectedDebtCoupon && inputVal && <p>expected uCR-NFT {formatEther(expectedDebtCoupon)}</p>}
    </div>
  );
};

export default UcrNftGenerator;