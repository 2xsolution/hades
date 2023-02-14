import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { Xhardes } from "../target/types/xhardes";
import { TOKEN_PROGRAM_ID, Token, ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { ASSOCIATED_PROGRAM_ID } from "@project-serum/anchor/dist/cjs/utils/token";
import { assert } from "chai";

describe("xhardes", () => {

  const STATISTIC_SEED = Buffer.from("statistic");
  const POOL_SEED = Buffer.from("pool");

  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.Xhardes as Program<Xhardes>;
  const adminKeypair = anchor.web3.Keypair.fromSecretKey(new Uint8Array([177,126,197,210,61,212,10,64,254,171,106,45,21,172,102,218,152,192,52,246,217,161,233,203,144,39,187,104,97,141,167,166,43,2,72,40,156,249,181,70,203,108,79,216,20,169,3,9,187,193,113,96,139,60,147,88,53,14,189,29,208,28,65,48]));
  const userKeypair = anchor.web3.Keypair.fromSecretKey(new Uint8Array([193,175,203,110,116,69,233,189,129,146,244,26,38,246,84,86,129,192,248,25,62,249,10,3,152,68,88,16,13,27,182,10,47,249,117,244,173,148,158,132,48,71,199,138,145,178,194,132,56,56,174,35,108,239,223,54,150,232,194,12,224,56,171,92]));
  const admin = adminKeypair.publicKey;
  const user = userKeypair.publicKey;
  const mintAmount = 100000 * Math.pow(10, 9);

  let hadesTokenMint: Token = null;
  let userAta = null;

  it("Is initialized!", async () => {
    // Add your test here.
    const method = program.methods.initialize();
    const statistic = await pda([STATISTIC_SEED], program.programId)
    method.accounts({
      statistic,
      admin,
      systemProgram: anchor.web3.SystemProgram.programId
    });
    method.signers([adminKeypair]);
    const tx = await method.rpc();
    console.log("Initialize tx", tx);
    
    await safeAirdrop(program.provider.connection, admin, 1000000000)
    await safeAirdrop(program.provider.connection, user, 1000000000)

    hadesTokenMint = await Token.createMint(
      program.provider.connection,
      adminKeypair,
      adminKeypair.publicKey,
      null,
      9,
      TOKEN_PROGRAM_ID
    );
    userAta = await hadesTokenMint.createAccount(user);
    await hadesTokenMint.mintTo(
      userAta,
      admin,
      [],
      mintAmount
    );

  });

  it("Swap !", async () => {
    // Add your test here.
    const swapAmount = 100.12345;
    const method = program.methods.swap(swapAmount);
    const statistic = await pda([STATISTIC_SEED], program.programId);
    const pool = await pda([POOL_SEED, user.toBuffer()], program.programId);
    const ataAdmin = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID, 
      TOKEN_PROGRAM_ID, 
      hadesTokenMint.publicKey, 
      admin
    );
    method.accounts({
      statistic,
      pool,
      user,
      admin,
      mint: hadesTokenMint.publicKey,
      ataFrom: userAta,
      ataTo: ataAdmin,
      systemProgram: anchor.web3.SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      rent: anchor.web3.SYSVAR_RENT_PUBKEY
    });
    method.signers([userKeypair]);
    const tx = await method.rpc();
    console.log('swap tx', tx);

    const poolData = await program.account.pool.fetch(pool);
    const statisticData = await program.account.statistic.fetch(statistic);

    let adminHadesBalance = ((await hadesTokenMint.getAccountInfo(ataAdmin)).amount as anchor.BN).toNumber();

    console.log('adminHadesBalance', adminHadesBalance);
    assert(adminHadesBalance / Math.pow(10, 9) == swapAmount, 'Wrong Balance');
    assert(poolData.balance == swapAmount, 'Wrong Balance');
    assert(statisticData.totalXhades == swapAmount, 'Wrong Total Amount');
  });
});

async function safeAirdrop(connection: anchor.web3.Connection, destination: anchor.web3.PublicKey, amount = 100000000) {
  while (await connection.getBalance(destination) < amount){
    try{
      // Request Airdrop for user
      await connection.confirmTransaction(
        await connection.requestAirdrop(destination, 100000000),
        "confirmed"
      );
    }catch{}
    
  };
}

async function pda(seeds: (Buffer | Uint8Array)[], programId: anchor.web3.PublicKey) {
  const [pdaKey, bump] = 
      await anchor.web3.PublicKey.findProgramAddress(
        seeds,
        programId,
      );
  return pdaKey
}
