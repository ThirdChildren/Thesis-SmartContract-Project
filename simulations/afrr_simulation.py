import json
import os
from web3 import Web3
import time
from dotenv import load_dotenv

# Carica le variabili dal file .env
load_dotenv()

# Connessione a Ganache
ganache_url = "http://172.20.208.1:7545"
web3 = Web3(Web3.HTTPProvider(ganache_url))

# Verifica della connessione
if web3.is_connected():
    print("Connected to Ganache")
else:
    print("Connection failed")

admin_account = web3.eth.accounts[0]
aggregator_admin_account = web3.eth.accounts[6]
tso_admin_account = web3.eth.accounts[7]

# Carica il file TSO.json
with open('./artifacts/contracts/TSO.sol/TSO.json') as f:
    tso_data = json.load(f)  # Carica una volta il file intero

# Estrai l'ABI e l'indirizzo del contratto TSO
tso_abi = tso_data['abi']
tso_address = os.getenv("TSO_CONTRACT_ADDRESS")  # Indirizzo del contratto TSO

# Carica il file Aggregator.json
with open('./artifacts/contracts/Aggregator.sol/Aggregator.json') as f:
    aggregator_data = json.load(f)  # Carica una volta il file intero

# Estrai l'ABI e l'indirizzo del contratto Aggregator
aggregator_abi = aggregator_data['abi']
aggregator_address = os.getenv("AGGREGATOR_CONTRACT_ADDRESS")  # Indirizzo del contratto Aggregator

# Inizializza il contratto
tso_contract = web3.eth.contract(address=tso_address, abi=tso_abi)
aggregator_contract = web3.eth.contract(address=aggregator_address, abi=aggregator_abi)

# Configurazione dei parametri di simulazione
time_slots = 4  # 1 ora divisa in 4 slot da 15 minuti
required_energy_per_slot = 2 * 1000  # 2 MWh convertiti in kWh


# Funzione per registrare le batterie
def register_batteries():
    for battery_index in range(1, 6):  # Simuliamo 5 batterie
        battery_owner = web3.eth.accounts[battery_index]
        capacity = 100  # Capacità della batteria in kWh (puoi variare a seconda delle necessità)
        soc = 80  # Stato di carica iniziale della batteria in percentuale

        # Esegui la funzione di registrazione della batteria nello smart contract
        tx_hash = aggregator_contract.functions.registerBattery(
            battery_owner,  # Proprietario della batteria
            capacity,       # Capacità della batteria in kWh
            soc,            # SoC iniziale
            True            # Indica che la batteria è registrata
        ).transact({'from': battery_owner})

        # Stampa l'hash della transazione di registrazione
        print(f"Battery {battery_owner} registered with capacity {capacity} kWh and SoC {soc}%")
        print(f"Transaction hash: {tx_hash.hex()}")

# Funzione per simulare una sessione di mercato
def simulate_market_session():
    time_slots = 4  # 1 ora divisa in 4 slot da 15 minuti
    required_energy_per_slot = 2 * 1000  # 2 MWh convertiti in kWh
    bid_count = 0  # Numero totale di bid
    next_bid_index = 0  # Indice della prossima bid da selezionare

    for slot in range(time_slots):
        # Step 1: Apri il mercato per lo slot corrente
        tso_contract.functions.openMarket(required_energy_per_slot, True).transact({'from': tso_admin_account})
        print(f"Market opened for time slot {slot + 1}")
        
        # Step 2: Batterie che partecipano alla bid
        for battery_index in range(1, 6):  # 5 batterie partecipano
            battery_owner = web3.eth.accounts[battery_index]
            
            # Verifica dello stato di carica (SoC) della batteria
            soc = aggregator_contract.functions.getBatterySoC(battery_owner).call()
            print(f"Battery {battery_owner} SoC: {soc}%")
            
            # Bid basata su SoC e tipo di riserva richiesta
            if soc >= 40:
                bid_amount = 100  # Simuliamo una bid tra 80 e 150 kWh
                bid_price = 90 + battery_index  # Prezzo della bid (varia tra le batterie)

                tso_contract.functions.placeBid(
                    aggregator_admin_account,  # Aggregatore
                    battery_owner,  # Proprietario della batteria
                    bid_amount,  # Volume in kWh
                    bid_price,  # Prezzo in EUR/MWh
                    battery_index - 1  # Indice della batteria
                ).transact({'from': tso_admin_account})
                
                print(f"Aggregator {aggregator_admin_account} placed a bid with {bid_amount} kWh at {bid_price} EUR/MWh")
                print(f"Bid index is: {tso_contract.functions.getBidIndex(bid_count).call()}")
                bid_count += 1
                return True
                
        
        # Step 3: Chiudi il mercato per lo slot corrente
        tso_contract.functions.closeMarket().transact({'from': tso_admin_account})
        print(f"Market closed for time slot {slot + 1}")

        # Step 4: Seleziona le bid fino a coprire l'energia richiesta
        while next_bid_index < 5:
            # Verifica che ci siano bid da processare prima di selezionare la prossima bid
            
            print (f"Next bid index: {next_bid_index}, Bid count: {bid_count}")
            if next_bid_index < bid_count:
                tso_contract.functions.selectNextBid(next_bid_index).transact({'from': tso_admin_account})
                print(f"Selected next bid for time slot {slot + 1}")
                print(f"Selected battery owner's bid: {tso_contract.functions.getBatteryOwner(next_bid_index).call()} with bid index: {tso_contract.functions.getBidIndex(next_bid_index).call()}")
                #tso_contract.functions.processNextPayment(next_bid_index).transact({'from': tso_admin_account})
            else:
                print("No more bids to process.")
                break
            next_bid_index += 1

        next_bid_index = 0
        bid_count = 0

        # Step 5: Processa i pagamenti e aggiorna lo stato di carica delle batterie
        
        #print(f"Payments processed for time slot {slot + 1}")

        # Aggiungi una pausa tra uno slot e l'altro (simulazione temporale)
        time.sleep(1)

    print("Market simulation complete.")

# Registra le batterie
register_batteries()
# Simula la sessione di mercato
#simulate_market_session()