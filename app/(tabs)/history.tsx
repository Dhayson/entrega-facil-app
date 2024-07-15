import React, { useState, useEffect } from 'react';
import { database } from '@/config/firebaseConfig';
import { collection, getDocs, query, where, Timestamp } from 'firebase/firestore';
import styled from 'styled-components/native';
import { Text, View, TouchableOpacity, TextInput, Modal, Dimensions, TouchableWithoutFeedback } from 'react-native'; // Import Dimensions and TouchableWithoutFeedback from react-native
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import Logo from '@/assets/images/logo-no-text.svg';
import SearchIcon from '@/assets/images/search-icon.svg';
import OrderDetail from '../orderDetail'; // Import the OrderDetail component

const HistoryContainer = styled(View)`
  flex: 1;
  padding: 10px;
  background-color: #f5f5f5;
`;

const HistoryItem = styled(View)`
  background-color: #ffffff;
  padding: 15px;
  margin-bottom: 20px;
  border-radius: 20px;
  flex-direction: row; /* Ensure items are aligned horizontally */
  align-items: center; /* Center items vertically */
`;

const HistoryText = styled(Text)`
  color: #3a3a3a;
  font-size: 14px;
  font-weight: 500;
  margin-right: 10px;
  margin-bottom: 4px;
`;

const HistoryTitleText = styled(Text)`
  color: #3a3a3a;
  font-size: 16px;
  font-weight: 700;
  margin-bottom: 4px;
  flex-wrap: wrap; /* Wrap text if it exceeds the container width */
`;

const LogoContainer = styled(View)`
  flex-direction: row;
  align-items: center;
`;

const StyledLogo = styled(Logo)`
  width: 60px;
  height: 60px;
  margin-right: 10px;
`;

const ActionDot = styled(View)`
  width: 8px;
  height: 8px;
  border-radius: 4px;
  margin-right: 8px;
`;

const ActionContainer = styled(View)`
  flex-direction: row;
  align-items: center;
  flex-wrap: wrap;
`;

const TabsContainer = styled(View)`
  flex-direction: row;
  margin-left: 30px;
  margin-bottom: 10px;
  margin-top: 20px;
`;

interface TabTextProps {
  selected: boolean;
}

const TabText = styled(Text)<TabTextProps>`
  font-size: 16px;
  font-weight: 500;
  margin-top: 20px;
  margin-bottom: 10px;
  padding-bottom: 10px;
  margin-right: 20px;
  color: ${({ selected }) => (selected ? '#FA4A0C' : '#9A9A9D')};
  border-bottom-width: ${({ selected }) => (selected ? '3px' : '0')};
  border-bottom-color: ${({ selected }) => (selected ? '#FA4A0C' : 'transparent')}; 
`;

const SearchContainer = styled(View)`
  flex-direction: row;
  align-items: center;
  justify-content: center; /* Center horizontally */
  margin-bottom: 20px;
`;

const SearchInput = styled(TextInput)`
  background-color: #ffffff;
  padding: 10px;
  border-radius: 10px;
  width: 90%;
`;

const SearchIconContainer = styled(View)`
  margin-right: 10px;
`;

export const getStatusColor = (status: string): string => {
  switch (status) {
    case 'processing':
      return '#FF5733'; // Vermelho
    case 'sent':
      return '#F5A623'; // Amarelo
    case 'received':
      return '#4CAF50'; // Verde
    default:
      return '#000000'; // Cor padrão, caso não haja correspondência
  }
};

export interface PackageHistoryItem {
  id: string;
  status: string;
  client_id: string;
  creation_date: Timestamp;
  arrival_date: Timestamp;
  delivery_actions: { [key: string]: { action: string; timestamp: Timestamp; notification_action?: string; } };
}

// Main History component
export default function History() {
  const router = useRouter();
  const [clientId, setClientId] = useState<string | null>(null);
  const [packageHistory, setPackageHistory] = useState<PackageHistoryItem[]>([]);
  const [selectedTab, setSelectedTab] = useState<'Em andamento' | 'Finalizado'>('Em andamento');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filteredOrders, setFilteredOrders] = useState<PackageHistoryItem[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>(''); // State to store selected product ID for OrderDetail

  // State to manage modal visibility and selected product ID
  const [modalVisible, setModalVisible] = useState(false);

  // Fetch data from Firebase based on client ID
  const fetchHistoryFromFirebase = async (clientId: string) => {
    try {
      const q = query(collection(database, 'products'), where('client_id', '==', clientId));
      const querySnapshot = await getDocs(q);
      const newEntries = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        delivery_actions: doc.data().delivery_actions || {},
      })) as PackageHistoryItem[];
      setPackageHistory(newEntries);
      filterOrdersByStatus(selectedTab, newEntries); // Filter initial orders by selected tab
    } catch (error) {
      console.error('Error fetching data: ', error);
    }
  };

  // Get client ID from AsyncStorage
  const getClientId = async () => {
    try {
      const clientId = await AsyncStorage.getItem('userEmail');
      if (clientId) {
        setClientId(clientId);
        fetchHistoryFromFirebase(clientId);
      } else {
        console.log('No client ID found');
      }
    } catch (error) {
      console.error('Error retrieving client ID: ', error);
    }
  };

  // Handle search input change
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    const filtered = packageHistory.filter((item) =>
      item.id.toLowerCase().includes(query.toLowerCase())
    );
    setFilteredOrders(filtered);
  };

  // Filter orders based on status (in progress or completed)
  const filterOrdersByStatus = (
    status: 'Em andamento' | 'Finalizado',
    orders: PackageHistoryItem[]
  ) => {
    const filtered = orders.filter((order) =>
      status === 'Em andamento' ? order.status !== 'received' : order.status === 'received'
    );
    setFilteredOrders(filtered);
  };

  // Handle order detail modal visibility
  const handleOrderDetail = (item_id: string) => {
    setSelectedProductId(item_id);
    setModalVisible(true); // Show modal for OrderDetail
  };

  // Get last delivery action for a given order
  const getLastAction = (delivery_actions: {
    [key: string]: { action: string; timestamp: Timestamp };
  }) => {
    const actions = Object.values(delivery_actions);
    if (actions.length === 0) return { action: 'Nenhuma ação disponível', timestamp: '' };

    actions.sort(
      (a, b) => b.timestamp.toDate().getTime() - a.timestamp.toDate().getTime()
    );
    const lastAction = actions[0];
    return {
      action: lastAction.action,
      timestamp: format(lastAction.timestamp.toDate(), "dd/MM/yyyy HH:mm", {
        locale: ptBR,
      }),
    };
  };

  // Fetch client ID on component mount
  useEffect(() => {
    getClientId();
  }, []);

  // Filter orders when selected tab or package history changes
  useEffect(() => {
    filterOrdersByStatus(selectedTab, packageHistory);
  }, [selectedTab, packageHistory]);

  // Render the History component
  return (
    <HistoryContainer>
      {/* Tabs for filtering orders */}
      <TabsContainer>
        <TouchableOpacity onPress={() => setSelectedTab('Em andamento')}>
          <TabText selected={selectedTab === 'Em andamento'}>Em andamento</TabText>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setSelectedTab('Finalizado')}>
          <TabText selected={selectedTab === 'Finalizado'}>Finalizado</TabText>
        </TouchableOpacity>
      </TabsContainer>

      {/* Search bar for filtering orders */}
      <SearchContainer>
        <SearchIconContainer>
          <SearchIcon />
        </SearchIconContainer>
        <SearchInput
          placeholder="Pesquise por um pedido"
          value={searchQuery}
          onChangeText={handleSearch}
        />
      </SearchContainer>

      {/* Render filtered orders */}
      {filteredOrders.map((item, index) => (
              <TouchableOpacity key={index} onPress={() => handleOrderDetail(item.id)}>
                <HistoryItem>
                  <StyledLogo />
                  <View style={{ flex: 1 }}>
                    <HistoryTitleText>Pedido {item.id}</HistoryTitleText>
                    <HistoryText>
                      Previsão de entrega:{' '}
                      {format(item.arrival_date.toDate(), "dd 'de' MMMM 'de' yyyy", {
                        locale: ptBR,
                      })}
                    </HistoryText>
                    <ActionContainer>
                      <ActionDot
                        style={{
                          backgroundColor: getStatusColor(item.status.toLowerCase()),
                        }}
                      />
                      <HistoryText
                        numberOfLines={1}
                        ellipsizeMode="tail"
                        style={{ flex: 1 }}
                      >
                        {getLastAction(item.delivery_actions).action}
                      </HistoryText>
                      <HistoryText
                        numberOfLines={1}
                        ellipsizeMode="tail"
                        style={{ flex: 1 }}
                      >
                        {getLastAction(item.delivery_actions).timestamp}
                      </HistoryText>
                    </ActionContainer>
                  </View>
                </HistoryItem>
              </TouchableOpacity>
            ))}

            {/* Modal for OrderDetail */}
            <Modal
              transparent={true}
              visible={modalVisible}
              onRequestClose={() => setModalVisible(false)}
            >
              <TouchableWithoutFeedback onPress={() => setModalVisible(false)}>
                <View
                  style={{
                    flex: 1,
                    justifyContent: 'center',
                    alignItems: 'center',
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                  }}
                >
                  <View
                    style={{
                      width: Dimensions.get('window').width * 0.9, // Set width to 90% of screen width
                      backgroundColor: 'white',
                      borderRadius: 10,
                      padding: 20,
                    }}
                  >
                    <OrderDetail
                      client_id={clientId}
                      product_id={selectedProductId}
                      closeModal={() => setModalVisible(false)}
                    />
                  </View>
                </View>
              </TouchableWithoutFeedback>
            </Modal>
          </HistoryContainer>
        );
      }