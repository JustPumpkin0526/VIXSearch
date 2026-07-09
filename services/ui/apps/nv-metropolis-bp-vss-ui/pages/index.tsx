// SPDX-License-Identifier: MIT
import { GetServerSideProps } from 'next';
import Head from 'next/head';

import Home from '../components/Home';
import { APPLICATION_TITLE } from '../constants/constants';

// Server-side props with data fetching
// services/ui/apps/nv-metropolis-bp-vss-ui/pages/index.tsx

export const getServerSideProps: GetServerSideProps = async (context) => {
  try {
    const { getNemoAgentToolkitSSProps } = await import(
      '@nemo-agent-toolkit/ui/server'
    );

    const { fetchVideoManagementData } = await import(
      '@nv-metropolis-bp-vss-ui/all/server'
    );

    const [nemoProps, videoManagementData] = await Promise.all([
      getNemoAgentToolkitSSProps(context),
      fetchVideoManagementData(),
    ]);

    return {
      props: {
        ...nemoProps.props,

        // 로그인 속도 개선을 위해 무거운 탭 데이터는 SSR에서 제외
        alertsData: null,
        searchData: null,
        dashboardData: null,
        mapData: null,

        // 업로드/삭제에 필요한 VST/Agent URL은 반드시 유지
        videoManagementData,

        serverRenderTime: new Date().toISOString(),
      },
    };
  } catch (error) {
    console.error('Error in getServerSideProps:', error);

    return {
      props: {
        alertsData: null,
        searchData: null,
        dashboardData: null,
        mapData: null,
        videoManagementData: null,
        serverRenderTime: new Date().toISOString(),
      },
    };
  }
};

// Props interface matching what getServerSideProps returns
interface HomePageProps {
  alertsData?: any;
  dashboardData?: any;
  mapData?: any;
  searchData?: any;
  videoManagementData?: any;
  serverRenderTime?: string;
}

export default function HomePage(props: HomePageProps) {
  // Pass all SSR props to Home component
  return (
    <>
      <Head>
        <title>{APPLICATION_TITLE}</title>
      </Head>
      <Home {...props} />
    </>
  );
}