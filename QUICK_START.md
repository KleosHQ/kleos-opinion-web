# Quick Start Guide

## How to Become Admin and Create Markets

### Step 1: Connect Your Solana Wallet
1. Go to the home page (`/`)
2. Click "Connect Solana Wallet"
3. Select a Solana wallet (Phantom, Solflare, or Backpack)
4. Approve the connection

### Step 2: Initialize Protocol (Become Admin)
1. Go to the Admin page (`/admin`)
2. You'll see "Initialize Protocol" section
3. Click "Initialize Protocol (Become Admin)" button
4. This will:
   - Set your wallet address as the admin authority
   - Set your wallet as the treasury
   - Set protocol fee to 0 (can be changed later)
   - Make you the admin!

### Step 3: Create Your First Market
1. After initialization, you'll see "Create New Market" button
2. Click it to go to `/markets/create`
3. Fill in the form:
   - **Category ID**: Any number (e.g., `0`)
   - **Token Mint**: Solana token mint address (use `So11111111111111111111111111111111111111112` for SOL)
   - **Start Timestamp**: Click "Now" or enter Unix timestamp
   - **End Timestamp**: Click "+7 Days" or enter Unix timestamp
   - **Market Items**: Add at least 2 items (e.g., "Yes", "No")
4. Click "Create Market"

### Step 4: Open the Market
1. Go to the market detail page
2. If you're admin and market is in "Draft" status, you'll see "Open Market" button
3. Click it to open the market for trading

### Step 5: Place Positions
1. Once market is "Open", users can place positions
2. Select an item
3. Enter raw stake (in SOL)
4. Set effective stake multiplier (1-20x)
5. Click "Place Position"

## Troubleshooting

### "You are not the admin"
- Make sure you initialized the protocol with your wallet
- Check that your connected wallet matches the admin authority
- If protocol was initialized by someone else, you cannot create markets

### "Protocol already initialized"
- Someone else already initialized it
- You need to use the wallet that was used for initialization
- Or clear the database and start fresh

### "Cannot create market"
- Make sure protocol is initialized
- Make sure you are the admin
- Make sure protocol is not paused
- Check that all form fields are filled correctly

## Example Market Creation

**Category ID**: `0`  
**Token Mint**: `So11111111111111111111111111111111111111112` (SOL)  
**Start Time**: Current time (click "Now")  
**End Time**: 7 days from now (click "+7 Days")  
**Items**: 
- "Bitcoin will reach $100k by end of 2024"
- "Bitcoin will NOT reach $100k by end of 2024"

This creates a simple Yes/No prediction market!
