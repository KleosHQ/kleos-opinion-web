"use client";

import { useCallback, useState } from "react";
import { PublicKey, Transaction } from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createSyncNativeInstruction,
  NATIVE_MINT,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { SystemProgram } from "@solana/web3.js";
import { useWallets } from "@privy-io/react-auth/solana";
import bs58 from "bs58";
import { positionsApi } from "@/lib/api";
import { useSolanaWallet } from "@/lib/hooks/useSolanaWallet";
import { useSolanaClient } from "@/lib/solana/useSolanaClient";
import { toast } from "@/lib/utils/toast";

interface MarketForBet {
  marketId: string;
  tokenMint: string;
}

export function useQuickBet() {
  const { address: walletAddress, publicKey } = useSolanaWallet();
  const { connection } = useSolanaClient();
  const { wallets } = useWallets();
  const [placing, setPlacing] = useState(false);

  const placeQuickBet = useCallback(
    async (
      market: MarketForBet,
      selectedItemIndex: number,
      rawStakeNum: number
    ): Promise<boolean> => {
      if (!walletAddress || !publicKey) {
        toast.error("Wallet not connected");
        return false;
      }

      const solanaWallet = wallets.find(
        (w) =>
          w.address &&
          !w.address.startsWith("0x") &&
          w.address === walletAddress
      );
      if (!solanaWallet) {
        toast.error("Solana wallet not found");
        return false;
      }

      setPlacing(true);
      try {
        const { marketId, tokenMint } = market;

        const effectiveStakeResponse = await positionsApi.calculateEffectiveStake(
          { wallet: walletAddress, rawStake: rawStakeNum / 1e9, marketId, selectedItemIndex }
        );
        const effectiveStakeLamports =
          effectiveStakeResponse.data.effectiveStakeLamports ??
          Math.floor(effectiveStakeResponse.data.effectiveStake * 1e9);
        const calculationTimestamp =
          effectiveStakeResponse.data.calculationTimestamp;

        const validationResponse = await positionsApi.create({
          marketId,
          user: walletAddress,
          selectedItemIndex,
          rawStake: (rawStakeNum / 1e9).toString(),
          effectiveStake: String(effectiveStakeLamports),
          calculationTimestamp,
        });

        if (!validationResponse.data.success) {
          throw new Error(
            validationResponse.data.error || "Validation failed"
          );
        }

        const transactionBuffer = Buffer.from(
          validationResponse.data.transaction,
          "base64"
        );
        const transaction = Transaction.from(transactionBuffer);

        const wrappedSolMint = "So11111111111111111111111111111111111111112";
        const requiredLamports = Math.floor(rawStakeNum * 1e9);
        let needsWrapping = false;
        const wrapInstructions: any[] = [];

        if (tokenMint === wrappedSolMint) {
          const tokenMintPubkey = new PublicKey(tokenMint);
          const userAta = await getAssociatedTokenAddress(
            tokenMintPubkey,
            publicKey
          );

          const ataInfo = await connection.getAccountInfo(userAta);

          if (!ataInfo) {
            needsWrapping = true;
            wrapInstructions.push(
              createAssociatedTokenAccountInstruction(
                publicKey,
                userAta,
                publicKey,
                NATIVE_MINT,
                TOKEN_PROGRAM_ID,
                ASSOCIATED_TOKEN_PROGRAM_ID
              ),
              SystemProgram.transfer({
                fromPubkey: publicKey,
                toPubkey: userAta,
                lamports: requiredLamports,
              }),
              createSyncNativeInstruction(userAta, TOKEN_PROGRAM_ID)
            );
          } else {
            const tokenBalance = await connection.getTokenAccountBalance(userAta);
            const balanceLamports = Number(tokenBalance.value.amount);
            if (balanceLamports < requiredLamports) {
              needsWrapping = true;
              const additionalAmount = requiredLamports - balanceLamports;
              wrapInstructions.push(
                SystemProgram.transfer({
                  fromPubkey: publicKey,
                  toPubkey: userAta,
                  lamports: additionalAmount,
                }),
                createSyncNativeInstruction(userAta, TOKEN_PROGRAM_ID)
              );
            }
          }
        }

        if (needsWrapping && wrapInstructions.length > 0) {
          transaction.instructions.unshift(...wrapInstructions);
        }

        const { blockhash, lastValidBlockHeight } = validationResponse.data;
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = publicKey;

        const signResult = await solanaWallet.signAndSendTransaction({
          transaction: transaction.serialize({
            requireAllSignatures: false,
            verifySignatures: false,
          }),
          chain: "solana:devnet",
        });

        const sigValue =
          typeof signResult === "string" ? signResult : signResult.signature;
        const signature =
          typeof sigValue === "string" ? sigValue : bs58.encode(sigValue);

        await connection.confirmTransaction(
          { signature, blockhash, lastValidBlockHeight },
          "confirmed"
        );

        const pos = validationResponse.data.position;
        const dbMarketId = validationResponse.data.dbMarketId;
        const breakdown = validationResponse.data.breakdown;

        await positionsApi.confirm({
          signature,
          marketId,
          user: walletAddress,
          selectedItemIndex,
          rawStake: pos.rawStake,
          effectiveStake: pos.effectiveStake,
          dbMarketId,
          breakdown,
          marketStartTs: validationResponse.data.marketStartTs,
          marketEndTs: validationResponse.data.marketEndTs,
        });

        toast.success("Quick bet placed!");
        return true;
      } catch (error: any) {
        console.error("Quick bet error:", error);
        toast.fromApiOrProgramError(error, "Failed to place quick bet");
        return false;
      } finally {
        setPlacing(false);
      }
    },
    [walletAddress, publicKey, connection, wallets]
  );

  return { placeQuickBet, placing };
}
