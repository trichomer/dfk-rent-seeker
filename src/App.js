import React, { useState, useEffect, useMemo } from 'react';
import { ethers } from 'ethers';
import Onboard from '@web3-onboard/core';
import injectedModule from '@web3-onboard/injected-wallets';
import assistingAuctionAbi from './abis/AssistingAuction.json';
import heroCoreDiamondAbi from './abis/HeroCoreDiamond.json';
import { Box, Button, Input, Typography, Card, CardContent, CardActions, Grid, Divider, ButtonGroup } from '@mui/material';
import crystal from "./assets/images/crystal.png";
import GitHubIcon from '@mui/icons-material/GitHub';
import { createTheme, ThemeProvider } from '@mui/material/styles';

const { decodeRecessiveGeneAndNormalize } = require("./constants/recessive-genes.js");
const DFK_RPC_URL = 'https://subnets.avax.network/defi-kingdoms/dfk-chain/rpc';
const RENTAL_CONTRACT_ADDRESS = '0x8101CfFBec8E045c3FAdC3877a1D30f97d301209';
const HEROES_CONTRACT_ADDRESS = '0xEb9B61B145D6489Be575D3603F4a704810e143dF';
const theme = createTheme({
  palette: {
    type: 'dark',
    primary: {
      main: '#808080',
    },
    secondary: {
      main: '#505050',
    },
    background: {
      default: '#303030',
      borderGradient: 'linear-gradient(45deg, #000, darkgray, gray)',
    },
    text: {
      primary: '#808080',
      secondary: '#505050',
    },
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: '15px',
          border: '3px solid',
          borderImageSource: 'linear-gradient(45deg, #000, darkgray, gray)',
          borderImageSlice: 1,
          borderTopWidth: '0px',
          borderLeftWidth: '0px',
          borderRightWidth: '1px',
          borderBottomWidth: '2px',
        },
      },
    },
  },
});
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
const advancedPlusActive = [
  "A1: Exhaust🔆",
  "A2: Daze🔆",
  "A3: Explosion🔆",
  "A4: Hardened Shield🔆",
  "E1: Stun❄️❄️",
  "E2: Second Wind❄️❄️",
  "Ex1: Resurrection🚨🚨🚨"
];
const advancedPlusPassive = [
  "A1: Leadership🔆",
  "A2: Efficient🔆",
  "A3: Intimidation🔆",
  "A4: Toxic🔆",
  "E1: Giant Slayer❄️❄️",
  "E2: Last Stand❄️❄️",
  "Ex1: Second Life🚨🚨🚨"
];


function RentCell({ hero, createAuction, cancelAuction }) {
  const [inputPrice, setInputPrice] = useState('');

  if (hero.isRenting) {
    const startingPrice = hero.startingPrice
      ? hero.startingPrice.toString()
      : 'unknown';
      return (
        <>
          <Box display="flex" alignItems="center">
            <Typography>{startingPrice}</Typography>
            <img
              src={crystal}
              alt="CRYSTAL"
              image={crystal}
              style={{ 
                height: "20px",
                width: "auto" 
              }}
            />
          </Box>
          <Button variant="outlined" onClick={() => cancelAuction(hero.id)}>
            Cancel
          </Button>
        </>
      );
  } else {
    return (
      <>
        <Input
          type="number"
          value={inputPrice}
          onChange={(e) => setInputPrice(e.target.value)}
          placeholder="Price (c)"
          sx={{ width: '100px' }}
        />
        <Button
          variant="contained"
          onClick={() => createAuction(hero.id, inputPrice, inputPrice, 60)}
        >
          Rent
        </Button>
      </>
    );
  }
}

function App() {
  const [provider, setProvider] = useState(null);
  const [heroes, setHeroes] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isHeroesFetched, setIsHeroesFetched] = useState(false);
  const [chainChanged, setChainChanged] = useState(false);
  const [advancedFilter, setAdvancedFilter] = useState(false);
  const [eliteFilter, setEliteFilter] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

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
        connect: {
          autoConnectLastWallet: true
        },
        theme: 'dark',
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

      const network = await ethersProvider.getNetwork();
      console.log(network);

      if (network.chainId !== 53935) {
        const success = await onboard.setChain({ chainId: '53935' });
        if (!success) {
          console.error('Failed to set chain to DFK Chain');
        } else {
          const newProvider = new ethers.providers.Web3Provider(wallets[0].provider, 'any');
          setProvider(newProvider);
        }
      }
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

      const network = await provider.getNetwork();
      if (network.chainId !== 53935) {
        console.log('Wallet not on DFK Chain');
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
    setChainChanged(false);
  }, [provider, chainChanged, refreshKey]);

  const cancelAuction = async (tokenId) => {
    if (!provider) return;
    const rentalContract = new ethers.Contract(
      RENTAL_CONTRACT_ADDRESS,
      assistingAuctionAbi,
      provider.getSigner()
    );
    try {
      const tx = await rentalContract.cancelAuction(tokenId);
      const receipt = await tx.wait();

      if (receipt.status === 1) {
        setRefreshKey(prevKey => prevKey + 1);
      }

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
      const tx = await rentalContract.createAuction(
        tokenId,
        weiStartingPrice,
        weiEndingPrice,
        duration,
        ethers.constants.AddressZero
      );
      const receipt = await tx.wait();

      if (receipt.status === 1) {
        setRefreshKey(prevKey => prevKey + 1);
      }

    } catch (error) {
      console.error(`Failed to create auction for hero ${tokenId}: ${error}`);
    }
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleString();
  };

  const filteredHeroes = heroes.filter((hero) => {
    const summonsRemaining = hero[1].maxSummons - hero[1].summons;
    return summonsRemaining !== 0;
  });

  let displayedHeroes = filteredHeroes;
  if (advancedFilter) {
    displayedHeroes = displayedHeroes.filter(hero => hero[2].class > 16 && hero[2].class < 24);
  }
  if (eliteFilter) {
    displayedHeroes = displayedHeroes.filter(hero => hero[2].class > 23);
  }


  return (
    <ThemeProvider theme={theme}>
      <Box sx={{ bgcolor: 'background.default' }}>
        <Typography variant="h5" sx={{ color: 'text.primary' }}>
          DFK Rent Seeker <a href="https://github.com/trichomer/dfk-rent-seeker" target="_blank" rel="noopener noreferrer"><GitHubIcon sx={{ color: 'white' }} /></a>
        </Typography>
        <Box display="flex" flexDirection="column">
          <Button variant="contained" onClick={connectWallet} sx={{ width: 'fit-content' }}>
            Connect
          </Button>
          <Divider sx={{ height: 2, bgcolor: 'secondary.main' }} />
          <ButtonGroup
            sx={{ '--ButtonGroup-radius': '20px' }}
          >
            <Button 
              variant={advancedFilter ? "contained" : "outlined"} 
              onClick={() => {setAdvancedFilter(!advancedFilter); setEliteFilter(false);}}
            >
              Advanced
            </Button>
            <Button 
              variant={eliteFilter ? "contained" : "outlined"}
              onClick={() => {setEliteFilter(!eliteFilter); setAdvancedFilter(false);}}
            >
              Elite
            </Button>
          </ButtonGroup>
        </Box>
        {isLoading ? (
          <Typography variant="h4" sx={{ color: 'text.primary' }}>Loading...</Typography>
        ) : (
          isHeroesFetched &&
          filteredHeroes.length > 0 && (
            <Grid container spacing={1} sx={{ bgcolor: 'background.default' }}>
              {displayedHeroes.map((hero, index) => {
                let decodedGenes = decodeRecessiveGeneAndNormalize(hero[2][0]);
                //console.log(decodedGenes);
                let [mainD, mainR1, mainR2, mainR3] = decodedGenes.mainClassGenes;
                let [subD, subR1, subR2, subR3] = decodedGenes.subClassGenes;
                let [a1D, a1R1, a1R2, a1R3] = decodedGenes.a1Genes;
                let [a2D, a2R1, a2R2, a2R3] = decodedGenes.a2Genes;
                let [p1D, p1R1, p1R2, p1R3] = decodedGenes.p1Genes;
                let [p2D, p2R1, p2R2, p2R3] = decodedGenes.p2Genes;
                //console.log(a1D);
                const heroInfo = {
                  id: hero[0].toString(),
                  class: classMap[hero[2].class],
                  sub: classMap[hero[2].subClass],
                  generation: hero[2].generation,
                  rarity: rarityMap[hero[2].rarity],
                  summons: hero[1].summons,
                  maxSummons: hero[1].maxSummons,
                  remainingSummons: hero[1].maxSummons - hero[1].summons,
                  isRenting: hero.isRenting,
                  startingPrice: hero.startingPrice,
                  nextSummonTime: formatTimestamp(hero[1].nextSummonTime),
                  r1: mainR1,
                  subr1: subR1,
                  a1d: a1D,
                  a2d: a2D,
                  p1d: p1D,
                  p2d: p2D,
                  a1r1: a1R1,
                  a2r1: a2R1,
                  p1r1: p1R1,
                  p2r1: p2R1,
                };
                return (
                  <Grid item xs={12} sm={6} md={4} lg={3} xl={2} key={index}>
                    <Card elevation={2} sx={{ bgcolor: 'background.default' }}>
                      <CardContent >
                        <Typography>{heroInfo.id}</Typography>
                          <Typography>M: {heroInfo.class} ({heroInfo.r1}) </Typography>
                          <Typography>S: {heroInfo.sub} ({heroInfo.subr1})</Typography>
                          <Typography>Gen: {heroInfo.generation} {heroInfo.rarity} {heroInfo.remainingSummons}/{heroInfo.maxSummons}</Typography>
                          <Typography>{heroInfo.a1d}{advancedPlusActive.includes(heroInfo.a1r1) ? '⭐' : ''}</Typography>
                          <Typography>{heroInfo.a2d}{advancedPlusActive.includes(heroInfo.a2r1) ? '⭐' : ''}</Typography>
                          <Typography>{heroInfo.p1d}{advancedPlusPassive.includes(heroInfo.p1r1) ? '⭐' : ''}</Typography>
                          <Typography>{heroInfo.p2d}{advancedPlusPassive.includes(heroInfo.p2r1) ? '⭐' : ''}</Typography>
                        <CardActions disableSpacing sx={{ paddingTop: 1, paddingBottom: 0 }}>
                          <RentCell
                            hero={heroInfo}
                            createAuction={createAuction}
                            cancelAuction={cancelAuction}
                          />
                          
                        </CardActions>
                        <Typography sx={{ fontSize: '0.7rem' }}>Next: {heroInfo.nextSummonTime}</Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                );
              })}
              
            </Grid>
            
          )
        )}
      </Box>
    </ThemeProvider>
  );
}

export default App;
