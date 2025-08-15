import { ClientRepository, ClientFilters, ClientCreateData, ClientUpdateData } from '../repositories/client.repository';
import { UserRepository } from '../repositories/user.repository';
import { 
  Client, 
  CreateClientRequest, 
  UpdateClientRequest, 
  ClientProfile,
  ClientSearchFilters,
  AddressInfo 
} from '../types/user.types';
import { ClientStatus, CLIENT_STATUS, USER_ROLES, PAGINATION_DEFAULTS } from '../utils/constants';
import logger from '../utils/logger';

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface ClientServiceError {
  message: string;
  code: string;
  statusCode: number;
}

export class ClientService {
  private clientRepository: ClientRepository;
  private userRepository: UserRepository;

  constructor() {
    this.clientRepository = new ClientRepository();
    this.userRepository = new UserRepository();
  }

  async createClient(clientData: CreateClientRequest): Promise<Client> {
    try {
      // Check if user exists
      const user = await this.userRepository.findById(clientData.userId);
      if (!user) {
        throw this.createError('User not found', 'USER_NOT_FOUND', 404);
      }

      // Check if user is a customer role
      if (user.role !== USER_ROLES.CUSTOMER) {
        throw this.createError('Only customer users can have client profiles', 'INVALID_USER_ROLE', 400);
      }

      // Check if client profile already exists for this user
      const existingClient = await this.clientRepository.findByUserId(clientData.userId);
      if (existingClient) {
        throw this.createError('Client profile already exists for this user', 'DUPLICATE_CLIENT', 409);
      }

      // Check if PAN number is already registered
      const existingPanClient = await this.clientRepository.findByPanNumber(clientData.panNumber);
      if (existingPanClient) {
        throw this.createError('PAN number already registered', 'DUPLICATE_PAN', 409);
      }

      // Validate PAN format
      if (!this.isValidPAN(clientData.panNumber)) {
        throw this.createError('Invalid PAN number format', 'INVALID_PAN_FORMAT', 400);
      }

      // Validate Aadhar format if provided
      if (clientData.aadharNumber && !this.isValidAadhar(clientData.aadharNumber)) {
        throw this.createError('Invalid Aadhar number format', 'INVALID_AADHAR_FORMAT', 400);
      }

      // Validate address
      if (!this.isValidAddress(clientData.address)) {
        throw this.createError('Invalid address format', 'INVALID_ADDRESS', 400);
      }

      const createData: ClientCreateData = {
        userId: clientData.userId,
        panNumber: clientData.panNumber.toUpperCase(),
        aadharNumber: clientData.aadharNumber,
        dateOfBirth: new Date(clientData.dateOfBirth),
        addressJson: clientData.address,
        occupation: clientData.occupation,
        annualIncome: clientData.annualIncome,
        status: CLIENT_STATUS.ACTIVE,
        onboardingCompleted: false,
      };

      const client = await this.clientRepository.create(createData);
      
      logger.info(`Client profile created: ${client.id}`, { 
        userId: client.userId, 
        panNumber: client.panNumber 
      });

      return client;
    } catch (error) {
      logger.error('Error creating client:', error);
      if (error instanceof Error && 'statusCode' in error) {
        throw error;
      }
      throw this.createError('Failed to create client profile', 'CREATE_ERROR', 500);
    }
  }

  async getClientById(id: number): Promise<ClientProfile | null> {
    try {
      const client = await this.clientRepository.findById(id);
      return client as unknown as ClientProfile;
    } catch (error) {
      logger.error(`Error fetching client ${id}:`, error);
      throw this.createError('Failed to fetch client', 'FETCH_ERROR', 500);
    }
  }

  async getClientByUserId(userId: number): Promise<ClientProfile | null> {
    try {
      const client = await this.clientRepository.findByUserId(userId);
      return client as unknown as ClientProfile;
    } catch (error) {
      logger.error(`Error fetching client by user ID ${userId}:`, error);
      throw this.createError('Failed to fetch client', 'FETCH_ERROR', 500);
    }
  }

  async getClientByPanNumber(panNumber: string): Promise<Client | null> {
    try {
      return await this.clientRepository.findByPanNumber(panNumber.toUpperCase());
    } catch (error) {
      logger.error(`Error fetching client by PAN ${panNumber}:`, error);
      throw this.createError('Failed to fetch client', 'FETCH_ERROR', 500);
    }
  }

  async getAllClients(filters: ClientSearchFilters = {}): Promise<PaginatedResult<ClientProfile>> {
    try {
      const page = filters.page || PAGINATION_DEFAULTS.PAGE;
      const limit = Math.min(filters.limit || PAGINATION_DEFAULTS.LIMIT, PAGINATION_DEFAULTS.MAX_LIMIT);
      const offset = (page - 1) * limit;

      const clientFilters: ClientFilters = {
        status: filters.status,
        caId: filters.caId,
        search: filters.search?.trim(),
      };

      const { clients, total } = await this.clientRepository.findAll(clientFilters, limit, offset);

      return {
        data: clients as unknown as ClientProfile[],
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1,
        },
      };
    } catch (error) {
      logger.error('Error fetching clients:', error);
      throw this.createError('Failed to fetch clients', 'FETCH_ERROR', 500);
    }
  }

  async updateClient(id: number, updateData: UpdateClientRequest): Promise<Client | null> {
    try {
      const client = await this.clientRepository.findById(id);
      if (!client) {
        throw this.createError('Client not found', 'NOT_FOUND', 404);
      }

      const updateFields: ClientUpdateData = {};

      // Handle CA assignment
      if (updateData.caId !== undefined) {
        if (updateData.caId) {
          const ca = await this.userRepository.findById(updateData.caId);
          if (!ca) {
            throw this.createError('CA not found', 'CA_NOT_FOUND', 404);
          }
          if (ca.role !== USER_ROLES.CA) {
            throw this.createError('User is not a CA', 'INVALID_CA_ROLE', 400);
          }
          updateFields.caId = updateData.caId;
        } else {
          updateFields.caId = null;
        }
      }

      if (updateData.aadharNumber !== undefined) {
        if (updateData.aadharNumber && !this.isValidAadhar(updateData.aadharNumber)) {
          throw this.createError('Invalid Aadhar number format', 'INVALID_AADHAR_FORMAT', 400);
        }
        updateFields.aadharNumber = updateData.aadharNumber;
      }

      if (updateData.dateOfBirth !== undefined) {
        updateFields.dateOfBirth = new Date(updateData.dateOfBirth);
      }

      if (updateData.address !== undefined) {
        if (!this.isValidAddress(updateData.address)) {
          throw this.createError('Invalid address format', 'INVALID_ADDRESS', 400);
        }
        updateFields.addressJson = updateData.address;
      }

      if (updateData.occupation !== undefined) {
        updateFields.occupation = updateData.occupation;
      }

      if (updateData.annualIncome !== undefined) {
        updateFields.annualIncome = updateData.annualIncome;
      }

      if (updateData.status !== undefined) {
        updateFields.status = updateData.status;
      }

      if (updateData.onboardingCompleted !== undefined) {
        updateFields.onboardingCompleted = updateData.onboardingCompleted;
      }

      if (updateData.profileJson !== undefined) {
        updateFields.profileJson = updateData.profileJson;
      }

      const updatedClient = await this.clientRepository.update(id, updateFields);
      
      if (updatedClient) {
        logger.info(`Client updated: ${id}`, { 
          changes: Object.keys(updateFields) 
        });
      }

      return updatedClient;
    } catch (error) {
      logger.error(`Error updating client ${id}:`, error);
      if (error instanceof Error && 'statusCode' in error) {
        throw error;
      }
      throw this.createError('Failed to update client', 'UPDATE_ERROR', 500);
    }
  }

  async deleteClient(id: number): Promise<boolean> {
    try {
      const client = await this.clientRepository.findById(id);
      if (!client) {
        throw this.createError('Client not found', 'NOT_FOUND', 404);
      }

      const deleted = await this.clientRepository.delete(id);
      
      if (deleted) {
        logger.info(`Client deleted: ${id}`, { 
          userId: client.userId,
          panNumber: client.panNumber 
        });
      }

      return deleted;
    } catch (error) {
      logger.error(`Error deleting client ${id}:`, error);
      if (error instanceof Error && 'statusCode' in error) {
        throw error;
      }
      throw this.createError('Failed to delete client', 'DELETE_ERROR', 500);
    }
  }

  async assignCA(clientId: number, caId: number): Promise<Client | null> {
    try {
      const client = await this.clientRepository.findById(clientId);
      if (!client) {
        throw this.createError('Client not found', 'NOT_FOUND', 404);
      }

      const ca = await this.userRepository.findById(caId);
      if (!ca) {
        throw this.createError('CA not found', 'CA_NOT_FOUND', 404);
      }

      if (ca.role !== USER_ROLES.CA) {
        throw this.createError('User is not a CA', 'INVALID_CA_ROLE', 400);
      }

      if (!ca.isActive) {
        throw this.createError('CA is not active', 'CA_INACTIVE', 400);
      }

      const updatedClient = await this.clientRepository.assignCA(clientId, caId);
      
      if (updatedClient) {
        logger.info(`CA assigned to client: ${clientId}`, { 
          caId,
          caEmail: ca.email 
        });
      }

      return updatedClient;
    } catch (error) {
      logger.error(`Error assigning CA to client ${clientId}:`, error);
      if (error instanceof Error && 'statusCode' in error) {
        throw error;
      }
      throw this.createError('Failed to assign CA', 'ASSIGN_CA_ERROR', 500);
    }
  }

  async unassignCA(clientId: number): Promise<Client | null> {
    try {
      const client = await this.clientRepository.findById(clientId);
      if (!client) {
        throw this.createError('Client not found', 'NOT_FOUND', 404);
      }

      if (!client.caId) {
        throw this.createError('Client has no assigned CA', 'NO_CA_ASSIGNED', 400);
      }

      const updatedClient = await this.clientRepository.unassignCA(clientId);
      
      if (updatedClient) {
        logger.info(`CA unassigned from client: ${clientId}`, { 
          previousCaId: client.caId 
        });
      }

      return updatedClient;
    } catch (error) {
      logger.error(`Error unassigning CA from client ${clientId}:`, error);
      if (error instanceof Error && 'statusCode' in error) {
        throw error;
      }
      throw this.createError('Failed to unassign CA', 'UNASSIGN_CA_ERROR', 500);
    }
  }

  async getClientsByCA(caId: number): Promise<Client[]> {
    try {
      const ca = await this.userRepository.findById(caId);
      if (!ca) {
        throw this.createError('CA not found', 'CA_NOT_FOUND', 404);
      }

      if (ca.role !== USER_ROLES.CA) {
        throw this.createError('User is not a CA', 'INVALID_CA_ROLE', 400);
      }

      return await this.clientRepository.findClientsByCA(caId);
    } catch (error) {
      logger.error(`Error fetching clients for CA ${caId}:`, error);
      if (error instanceof Error && 'statusCode' in error) {
        throw error;
      }
      throw this.createError('Failed to fetch CA clients', 'FETCH_ERROR', 500);
    }
  }

  async completeOnboarding(clientId: number): Promise<Client | null> {
    try {
      const client = await this.clientRepository.findById(clientId);
      if (!client) {
        throw this.createError('Client not found', 'NOT_FOUND', 404);
      }

      if (client.onboardingCompleted) {
        throw this.createError('Onboarding already completed', 'ALREADY_COMPLETED', 400);
      }

      // Validate required fields for onboarding completion
      if (!client.panNumber || !client.dateOfBirth || !client.addressJson) {
        throw this.createError('Missing required fields for onboarding completion', 'INCOMPLETE_DATA', 400);
      }

      const updatedClient = await this.clientRepository.update(clientId, {
        onboardingCompleted: true,
      });
      
      if (updatedClient) {
        logger.info(`Client onboarding completed: ${clientId}`);
      }

      return updatedClient;
    } catch (error) {
      logger.error(`Error completing onboarding for client ${clientId}:`, error);
      if (error instanceof Error && 'statusCode' in error) {
        throw error;
      }
      throw this.createError('Failed to complete onboarding', 'ONBOARDING_ERROR', 500);
    }
  }

  async getClientStats(): Promise<{
    total: number;
    active: number;
    inactive: number;
    suspended: number;
    unassigned: number;
    incompleteOnboarding: number;
  }> {
    try {
      const [total, active, inactive, suspended, unassigned, incompleteOnboarding] = await Promise.all([
        this.clientRepository.countByStatus(CLIENT_STATUS.ACTIVE),
        this.clientRepository.countByStatus(CLIENT_STATUS.ACTIVE),
        this.clientRepository.countByStatus(CLIENT_STATUS.INACTIVE),
        this.clientRepository.countByStatus(CLIENT_STATUS.SUSPENDED),
        this.clientRepository.findUnassignedClients().then(clients => clients.length),
        this.clientRepository.findIncompleteOnboarding().then(clients => clients.length),
      ]);

      return {
        total: active + inactive + suspended,
        active,
        inactive,
        suspended,
        unassigned,
        incompleteOnboarding,
      };
    } catch (error) {
      logger.error('Error fetching client stats:', error);
      throw this.createError('Failed to fetch client statistics', 'STATS_ERROR', 500);
    }
  }

  // Validation helpers
  private isValidPAN(pan: string): boolean {
    return /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(pan);
  }

  private isValidAadhar(aadhar: string): boolean {
    return /^\d{12}$/.test(aadhar);
  }

  private isValidAddress(address: AddressInfo): boolean {
    const required = ['street', 'city', 'state', 'pincode', 'country'];
    return required.every(field => address[field as keyof AddressInfo]);
  }

  private createError(message: string, code: string, statusCode: number): Error & ClientServiceError {
    const error = new Error(message) as Error & ClientServiceError;
    error.code = code;
    error.statusCode = statusCode;
    return error;
  }
}

export default ClientService; 