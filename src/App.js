import React, { useState, useEffect, useMemo } from 'react';
import { ethers } from 'ethers';
import Onboard from '@web3-onboard/core';
import injectedModule from '@web3-onboard/injected-wallets';
import assistingAuctionAbi from './abis/AssistingAuction.json';
import heroCoreDiamondAbi from './abis/HeroCoreDiamond.json';
import { Button, Input, Typography, Card, CardContent, CardActions } from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';

const DFK_RPC_URL = 'https://subnets.avax.network/defi-kingdoms/dfk-chain/rpc';
const RENTAL_CONTRACT_ADDRESS = '0x8101CfFBec8E045c3FAdC3877a1D30f97d301209';
const HEROES_CONTRACT_ADDRESS = '0xEb9B61B145D6489Be575D3603F4a704810e143dF';
const classMap = {
  0: 'Warrior',
  1: 'Knight',
  2: 'Thief',
  3: 'Archer',
  4: 'Priest',
  5: 'Wizard',
  6: 'Monk',
  7: 'Pirate',
  8: 'Berserker',
  9: 'Seer',
  10: 'Legionnaire',
  11: 'Scholar',
  16: 'Paladin',
  17: 'DarkKnight',
  18: 'Summoner',
  19: 'Ninja',
  20: 'Shapeshifter',
  21: 'Bard',
  24: 'Dragoon',
  25: 'Sage',
  26: 'SpellBow',
  28: 'DreadKnight',
};
const rarityMap = {
  4: '🟪',
  3: '🟧',
  2: '🟦',
  1: '🟩',
  0: '⬜',
};

function RentCell({ hero, createAuction, cancelAuction }) {
  const [inputPrice, setInputPrice] = useState('');

  if (hero.isRenting) {
    const startingPrice = hero.startingPrice
      ? hero.startingPrice.toString()
      : 'unknown';
    return (
      <div>
        <Typography>Renting: {startingPrice} C</Typography>
        <Button variant="contained" onClick={() => cancelAuction(hero.id)}>
          Cancel
        </Button>
      </div>
    );
  } else {
    return (
      <div>
        <Input
          type="number"
          value={inputPrice}
          onChange={(e) => setInputPrice(e.target.value)}
          placeholder="Price in C"
          sx={{
            width: '80px',
          }}
        />
        <Button
          variant="contained"
          onClick={() => createAuction(hero.id, inputPrice, inputPrice, 60)}
        >
          Rent
        </Button>
      </div>
    );
  }
}

function App() {
  const [provider, setProvider] = useState(null);
  const [heroes, setHeroes] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isHeroesFetched, setIsHeroesFetched] = useState(false);

  const injected = injectedModule();

  const onboard = useMemo(
    () =>
      Onboard({
        wallets: [injected],
        chains: [
          {
            id: '53935',
            token: 'JEWEL',
            label: 'DFK Chain',
            rpcUrl: DFK_RPC_URL,
          },
        ],
      }),
    []
  );

  const connectWallet = async () => {
    const wallets = await onboard.connectWallet();
    if (wallets[0]) {
      const ethersProvider = new ethers.providers.Web3Provider(
        wallets[0].provider,
        'any'
      );
      setProvider(ethersProvider);
    }
  };

  const getRentedHeroIds = async (address) => {
    if (!provider) return [];
    const rentalContract = new ethers.Contract(
      RENTAL_CONTRACT_ADDRESS,
      assistingAuctionAbi,
      provider
    );
    return await rentalContract.getUserAuctions(address);
  };

  const getAuctionDetails = async (tokenId) => {
    if (!provider) return null;
    const rentalContract = new ethers.Contract(
      RENTAL_CONTRACT_ADDRESS,
      assistingAuctionAbi,
      provider
    );
    return await rentalContract.getAuction(tokenId);
  };

  const fetchRentalStatus = async (heroesData) => {
    if (!provider) return [];

    const walletAddress = await provider.getSigner().getAddress();
    const rentedHeroIds = (await getRentedHeroIds(walletAddress)).map((id) =>
      id.toString()
    );

    const updatedHeroes = heroesData.map((hero) => {
      const heroId = hero[0].toString();
      const isRenting = rentedHeroIds.includes(heroId);
      return { ...hero, isRenting };
    });

    const heroesWithAuctionDetails = await Promise.all(
      updatedHeroes.map(async (hero) => {
        if (hero.isRenting) {
          const auctionDetails = await getAuctionDetails(hero[0]);
          const open = auctionDetails[7];
          if (open) {
            const startingPrice = ethers.utils.formatUnits(
              auctionDetails[2],
              'ether'
            );
            return { ...hero, startingPrice };
          }
        }
        return hero;
      })
    );

    return heroesWithAuctionDetails;
  };

  useEffect(() => {
    const fetchHeroes = async () => {
      if (!provider) {
        return;
      }
      setIsLoading(true);
      if (provider) {
        const heroesContract = new ethers.Contract(
          HEROES_CONTRACT_ADDRESS,
          heroCoreDiamondAbi,
          provider
        );

        const walletAddress = await provider.getSigner().getAddress();
        const ids = await heroesContract.getUserHeroes(walletAddress);

        const heroesData = await heroesContract.getHeroesV2(ids);

        const heroesWithRentalStatus = await fetchRentalStatus(heroesData);
        setHeroes(heroesWithRentalStatus);
        setIsHeroesFetched(true);
        setIsLoading(false);
      }
    };

    fetchHeroes();
  }, [provider]);

  const renderRentStatus = (params) => {
    const hero = params.row;
    return (
      <RentCell
        hero={hero}
        createAuction={createAuction}
        cancelAuction={cancelAuction}
      />
    );
  };

  const cancelAuction = async (tokenId) => {
    if (!provider) return;
    const rentalContract = new ethers.Contract(
      RENTAL_CONTRACT_ADDRESS,
      assistingAuctionAbi,
      provider.getSigner()
    );
    try {
      await rentalContract.cancelAuction(tokenId);
    } catch (error) {
      console.error(`Failed to cancel auction for hero ${tokenId}: ${error}`);
    }
  };

  const createAuction = async (
    tokenId,
    startingPrice,
    endingPrice,
    duration
  ) => {
    if (!provider) return;
    const rentalContract = new ethers.Contract(
      RENTAL_CONTRACT_ADDRESS,
      assistingAuctionAbi,
      provider.getSigner()
    );
    try {
      const weiStartingPrice = ethers.utils.parseEther(startingPrice);
      const weiEndingPrice = ethers.utils.parseEther(endingPrice);
      await rentalContract.createAuction(
        tokenId,
        weiStartingPrice,
        weiEndingPrice,
        duration,
        ethers.constants.AddressZero
      );
    } catch (error) {
      console.error(`Failed to create auction for hero ${tokenId}: ${error}`);
    }
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleString();
  };

  const filteredHeroes = heroes.filter((hero) => hero[1].summons !== 0);

  const columns = [
    { field: 'id', headerName: 'ID', width: 130 },
    { field: 'class', headerName: 'Main', width: 100 },
    { field: 'sub', headerName: 'Sub', width: 100 },
    { field: 'generation', headerName: 'Gen', width: 30 },
    { field: 'rarity', headerName: 'Rarity', width: 50 },
    { field: 'summons', headerName: 'S', width: 20 },
    { field: 'maxSummons', headerName: 'Max', width: 20 },
    {
      field: 'rent',
      headerName: 'Rent',
      width: 250,
      renderCell: renderRentStatus,
    },
    {
      field: 'nextSummonTime',
      headerName: 'Next',
      width: 200,
      valueGetter: (params) => formatTimestamp(params.value),
    },
  ];

  const sortModel = [
    {
      field: 'nextSummonTime',
      sort: 'asc',
    },
  ];

  return (
    <div>
      <Typography variant="h5">DFK Rent Seeker</Typography>
      <Button variant="contained" onClick={connectWallet}>
        Connect Wallet
      </Button>
      {isLoading ? (
        <p>Loading...</p>
      ) : (
        isHeroesFetched &&
        filteredHeroes.length > 0 && (
          <div style={{ height: 800, width: '100%' }}>
            <DataGrid
              rows={filteredHeroes.map((hero, index) => ({
                id: hero[0].toString(),
                class: classMap[hero[2].class],
                sub: classMap[hero[2].subClass],
                generation: hero[2].generation,
                rarity: rarityMap[hero[2].rarity],
                summons: hero[1].summons,
                maxSummons: hero[1].maxSummons,
                isRenting: hero.isRenting,
                startingPrice: hero.startingPrice,
                nextSummonTime: hero[1].nextSummonTime,
              }))}
              columns={columns}
              pageSize={5}
              sortModel={sortModel}
            />
          </div>
        )
      )}
    </div>
  );
}

export default App;
